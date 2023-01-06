/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/

require('reflect-metadata');

import { DatabaseDriver, DatabaseOption, Index, Encrypted } from '../../typings';
import { DataSource, DataSourceOptions, Like } from 'typeorm';
import * as dbutils from '../utils';
import * as mssql from './mssql';

class Sql implements DatabaseDriver {
  private options: DatabaseOption;
  private dataSource!: DataSource;
  private storeRepository;
  private indexRepository;
  private ttlRepository;
  private ttlCleanup;
  private timerId;

  private JacksonStore;
  private JacksonIndex;
  private JacksonTTL;

  constructor(options: DatabaseOption) {
    this.options = options;
  }

  async init({ JacksonStore, JacksonIndex, JacksonTTL }): Promise<Sql> {
    const sqlType = this.options.engine === 'planetscale' ? 'mysql' : this.options.type!;
    while (true) {
      try {
        const baseOpts = {
          type: sqlType,
          synchronize: this.options.engine !== 'planetscale',
          migrationsTableName: '_jackson_migrations',
          logging: ['error'],
          entities: [JacksonStore, JacksonIndex, JacksonTTL],
        };

        if (sqlType === 'mssql') {
          const mssqlOpts = mssql.parseURL(this.options.url);
          this.dataSource = new DataSource(<DataSourceOptions>{
            host: mssqlOpts.host,
            port: mssqlOpts.port,
            database: mssqlOpts.database,
            username: mssqlOpts.username,
            password: mssqlOpts.password,
            options: mssqlOpts.options,
            ...baseOpts,
          });
        } else {
          this.dataSource = new DataSource(<DataSourceOptions>{
            url: this.options.url,
            ssl: this.options.ssl,
            ...baseOpts,
          });
        }
        await this.dataSource.initialize();

        break;
      } catch (err) {
        console.error(`error connecting to engine: ${this.options.engine}, type: ${sqlType} db: ${err}`);
        await dbutils.sleep(1000);
        continue;
      }
    }

    this.JacksonStore = JacksonStore;
    this.JacksonIndex = JacksonIndex;
    this.JacksonTTL = JacksonTTL;

    this.storeRepository = this.dataSource.getRepository(JacksonStore);
    this.indexRepository = this.dataSource.getRepository(JacksonIndex);
    this.ttlRepository = this.dataSource.getRepository(JacksonTTL);

    if (this.options.ttl && this.options.cleanupLimit) {
      this.ttlCleanup = async () => {
        const now = Date.now();

        while (true) {
          const ids = await this.ttlRepository
            .createQueryBuilder('jackson_ttl')
            .limit(this.options.cleanupLimit)
            .where('jackson_ttl.expiresAt <= :expiresAt', {
              expiresAt: now,
            })
            .getMany();

          if (ids.length <= 0) {
            break;
          }

          const delIds = ids.map((id) => {
            return id.key;
          });

          await this.storeRepository.remove(ids);
          await this.ttlRepository.delete(delIds);
        }

        this.timerId = setTimeout(this.ttlCleanup, this.options.ttl! * 1000);
      };

      this.timerId = setTimeout(this.ttlCleanup, this.options.ttl! * 1000);
    } else {
      console.warn(
        'Warning: ttl cleanup not enabled, set both "ttl" and "cleanupLimit" options to enable it!'
      );
    }

    return this;
  }

  async get(namespace: string, key: string): Promise<any> {
    const res = await this.storeRepository.findOneBy({
      key: dbutils.key(namespace, key),
    });

    if (res && res.value) {
      return {
        value: res.value,
        iv: res.iv,
        tag: res.tag,
      };
    }

    return null;
  }

  async getAll(namespace: string, pageOffset?: number, pageLimit?: number): Promise<unknown[]> {
    const skipOffsetAndLimitValue = !dbutils.isNumeric(pageOffset) && !dbutils.isNumeric(pageLimit);
    const res = await this.storeRepository.find({
      where: { key: Like(`%${namespace}%`) },
      select: ['value', 'iv', 'tag'],
      order: {
        ['createdAt']: 'DESC',
      },
      take: skipOffsetAndLimitValue ? this.options.pageLimit : pageLimit,
      skip: skipOffsetAndLimitValue ? 0 : pageOffset,
    });
    return JSON.parse(JSON.stringify(res)) || [];
  }

  async getByIndex(namespace: string, idx: Index, pageOffset?: number, pageLimit?: number): Promise<any> {
    const skipOffsetAndLimitValue = !dbutils.isNumeric(pageOffset) && !dbutils.isNumeric(pageLimit);
    const res = skipOffsetAndLimitValue
      ? await this.indexRepository.findBy({
          key: dbutils.keyForIndex(namespace, idx),
        })
      : await this.indexRepository.find({
          where: { key: dbutils.keyForIndex(namespace, idx) },
          take: skipOffsetAndLimitValue ? this.options.pageLimit : pageLimit,
          skip: skipOffsetAndLimitValue ? 0 : pageOffset,
          order: {
            ['id']: 'DESC',
          },
        });

    const ret: Encrypted[] = [];
    if (res) {
      for (const r of res) {
        let value = r.store;
        if (this.options.engine === 'planetscale') {
          value = await this.storeRepository.findOneBy({
            key: r.storeKey,
          });
        }

        ret.push({
          value: value.value,
          iv: value.iv,
          tag: value.tag,
        });
      }
    }

    return ret;
  }

  async put(namespace: string, key: string, val: Encrypted, ttl = 0, ...indexes: any[]): Promise<void> {
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const dbKey = dbutils.key(namespace, key);

      const store = new this.JacksonStore();
      store.key = dbKey;
      store.value = val.value;
      store.iv = val.iv;
      store.tag = val.tag;
      store.modifiedAt = new Date().toISOString();
      await transactionalEntityManager.save(store);

      if (ttl) {
        const ttlRec = new this.JacksonTTL();
        ttlRec.key = dbKey;
        ttlRec.expiresAt = Date.now() + ttl * 1000;
        await transactionalEntityManager.save(ttlRec);
      }

      // no ttl support for secondary indexes
      for (const idx of indexes || []) {
        const key = dbutils.keyForIndex(namespace, idx);
        const rec = await transactionalEntityManager.findOneBy(this.JacksonIndex, {
          key,
          storeKey: store.key,
        });
        if (!rec) {
          const ji = new this.JacksonIndex();
          ji.key = key;
          if (this.options.engine === 'planetscale') {
            ji.storeKey = store.key;
          } else {
            ji.store = store;
          }
          await transactionalEntityManager.save(ji);
        }
      }
    });
  }

  async delete(namespace: string, key: string): Promise<any> {
    const dbKey = dbutils.key(namespace, key);
    await this.ttlRepository.remove({ key: dbKey });

    if (this.options.engine === 'planetscale') {
      const response = await this.indexRepository.find({
        where: { storeKey: dbKey },
        select: ['id'],
      });
      const returnValue = response || [];

      for (const r of returnValue) {
        await this.indexRepository.remove({
          id: r.id,
        });
      }
    }

    return await this.storeRepository.remove({
      key: dbKey,
    });
  }
}

export default {
  new: async (options: DatabaseOption, entities): Promise<Sql> => {
    return await new Sql(options).init(entities);
  },
};
