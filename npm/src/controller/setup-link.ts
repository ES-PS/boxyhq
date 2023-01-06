import { SetupLink, SetupLinkCreatePayload, Storable } from '../typings';
import * as dbutils from '../db/utils';
import { IndexNames, validateTenantAndProduct } from './utils';
import crypto from 'crypto';
import { JacksonError } from './error';

export class SetupLinkController {
  setupLinkStore: Storable;

  constructor({ setupLinkStore }) {
    this.setupLinkStore = setupLinkStore;
  }

  // Create a new setup link
  async create(body: SetupLinkCreatePayload): Promise<SetupLink> {
    const { tenant, product, service, regenerate } = body;

    validateTenantAndProduct(tenant, product);

    const setupID = dbutils.keyDigest(dbutils.keyFromParts(tenant, product, service));
    const token = crypto.randomBytes(24).toString('hex');

    const existing: SetupLink[] = await this.setupLinkStore.getByIndex({
      name: IndexNames.TenantProductService,
      value: dbutils.keyFromParts(tenant, product, service),
    });

    if (existing.length > 0 && !regenerate && !this.isExpired(existing[0])) {
      return existing[0];
    }

    // Remove the existing setup link if regenerate is true
    if (regenerate) {
      await this.setupLinkStore.delete(existing[0].setupID);
    }

    const setupLink = {
      setupID,
      tenant,
      product,
      service,
      validTill: +new Date(new Date().setDate(new Date().getDate() + 3)),
      url: `${process.env.NEXTAUTH_URL}/setup/${token}`,
    };

    await this.setupLinkStore.put(
      setupID,
      setupLink,
      {
        name: IndexNames.SetupToken,
        value: token,
      },
      {
        name: IndexNames.TenantProductService,
        value: dbutils.keyFromParts(tenant, product, service),
      },
      {
        name: IndexNames.Service,
        value: service,
      }
    );

    return setupLink;
  }

  // Get a setup link by token
  async getByToken(token: string): Promise<SetupLink> {
    if (!token) {
      throw new JacksonError('Missing setup link token', 400);
    }

    const setupLink: SetupLink[] = await this.setupLinkStore.getByIndex({
      name: IndexNames.SetupToken,
      value: token,
    });

    if (!setupLink || setupLink.length === 0) {
      throw new JacksonError('Setup link is not found', 404);
    }

    if (this.isExpired(setupLink[0])) {
      throw new JacksonError('Setup link is expired', 401);
    }

    return setupLink[0];
  }

  // Get setup links by service
  async getByService(service: string, pageOffset?: number, pageLimit?: number): Promise<SetupLink[]> {
    if (!service) {
      throw new JacksonError('Missing service name', 400);
    }

    const setupLinks = await this.setupLinkStore.getByIndex(
      {
        name: IndexNames.Service,
        value: service,
      },
      pageOffset,
      pageLimit
    );

    return setupLinks;
  }

  // Remove a setup link
  async remove(key: string): Promise<boolean> {
    if (!key) {
      throw new JacksonError('Missing setup link key', 400);
    }

    await this.setupLinkStore.delete(key);

    return true;
  }

  // Check if a setup link is expired or not
  isExpired(setupLink: SetupLink): boolean {
    return setupLink.validTill < +new Date();
  }
}
