import { DatabaseEngine, DatabaseType } from '@boxyhq/saml-jackson';

const hostUrl = process.env.HOST_URL || 'localhost';
const hostPort = Number(process.env.PORT || '5225');
const externalUrl = process.env.EXTERNAL_URL || 'http://' + hostUrl + ':' + hostPort;
const samlPath = '/api/oauth/saml';
const idpDiscoveryPath = '/idp/select';

const apiKeys = (process.env.JACKSON_API_KEYS || '').split(',');

const samlAudience = process.env.SAML_AUDIENCE;
const preLoadedConfig = process.env.PRE_LOADED_CONFIG;

const idpEnabled = process.env.IDP_ENABLED === 'true';
const db = {
  engine: process.env.DB_ENGINE ? <DatabaseEngine>process.env.DB_ENGINE : undefined,
  url: process.env.DB_URL || process.env.DATABASE_URL,
  type: process.env.DB_TYPE ? <DatabaseType>process.env.DB_TYPE : undefined,
  ttl: process.env.DB_TTL ? Number(process.env.DB_TTL) : undefined,
  cleanupLimit: process.env.DB_CLEANUP_LIMIT ? Number(process.env.DB_CLEANUP_LIMIT) : undefined,
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
  pageLimit: process.env.DB_PAGE_LIMIT ? Number(process.env.DB_PAGE_LIMIT) : undefined,
};

const clientSecretVerifier = process.env.CLIENT_SECRET_VERIFIER;
const jwtSigningKeys = {
  private: Buffer.from(process.env.RSA_PRIVATE_KEY || '', 'base64'),
  public: Buffer.from(process.env.RSA_PUBLIC_KEY || '', 'base64'),
};

export default {
  hostUrl,
  hostPort,
  externalUrl,
  samlPath,
  idpDiscoveryPath,
  samlAudience,
  preLoadedConfig,
  apiKeys,
  idpEnabled,
  db,
  clientSecretVerifier,
  jwtSigningKeys,
};
