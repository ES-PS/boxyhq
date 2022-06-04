import type { Storable, User, DatabaseStore, Index } from '../typings';
import { v4 as uuidv4 } from 'uuid';

export class UsersController {
  private _store: Storable | null = null;
  private db: DatabaseStore;
  private tenant = '';
  private product = '';

  constructor({ db }: { db: DatabaseStore }) {
    this.db = db;
  }

  // Return the database store
  private store(): Storable {
    return this._store || (this._store = this.db.store(`users:${this.tenant}:${this.product}`));
  }

  public with(tenant: string, product: string): UsersController {
    this.tenant = tenant;
    this.product = product;

    return this;
  }

  public setTenantAndProduct(tenant: string, product: string) {
    this.tenant = tenant;
    this.product = product;
  }

  // Create a new user
  public async create(param: {
    first_name: string;
    last_name: string;
    email: string;
    raw: any;
  }): Promise<User> {
    const { first_name, last_name, email, raw } = param;

    const id = uuidv4();

    raw['id'] = id;

    const user = {
      id,
      first_name,
      last_name,
      email,
      raw,
    };

    await this.store().put(id, user);

    return user;
  }

  // Get a user by id
  public async get(id: string): Promise<User> {
    return await this.store().get(id);
  }

  // Update the user data
  public async update(
    id: string,
    param: {
      first_name: string;
      last_name: string;
      email: string;
      raw: object;
    }
  ): Promise<User> {
    const { first_name, last_name, email, raw } = param;

    raw['id'] = id;

    const user = {
      id,
      first_name,
      last_name,
      email,
      raw,
    };

    await this.store().put(id, user);

    return user;
  }

  // Delete a user by id
  public async delete(id: string): Promise<void> {
    await this.store().delete(id);
  }

  // Get all users in a directory
  public async getAll(): Promise<User[]> {
    return (await this.store().getAll()) as User[];
  }

  // Get the users by tenant and product
  public async list({ tenant, product }: { tenant: string; product: string }): Promise<User[]> {
    return await this.with(tenant, product).getAll();
  }
}
