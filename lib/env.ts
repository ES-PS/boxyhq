import { DatabaseEngine, DatabaseType } from '@boxyhq/saml-jackson';

const hostUrl = process.env.HOST_URL || 'localhost';
const hostPort = Number(process.env.PORT || '5225');
const externalUrl = process.env.EXTERNAL_URL || 'http://' + hostUrl + ':' + hostPort;
const samlPath = '/api/oauth/saml';

const apiKeys = (process.env.JACKSON_API_KEYS || '').split(',');

const samlAudience = process.env.SAML_AUDIENCE;
const preLoadedConfig = process.env.PRE_LOADED_CONFIG;

const idpEnabled = process.env.IDP_ENABLED === 'true';
const db = {
  engine: process.env.DB_ENGINE ? <DatabaseEngine>process.env.DB_ENGINE : undefined,
  url: process.env.DB_URL || process.env.DATABASE_URL,
  type: process.env.DB_TYPE ? <DatabaseType>process.env.DB_TYPE : undefined,
  ttl: process.env.DB_TTL ? Number(process.env.DB_TTL) : undefined,
  encryptionKey: process.env.DB_ENCRYPTION_KEY,
};

const clientSecretVerifier = process.env.CLIENT_SECRET_VERIFIER;

export default {
  hostUrl,
  hostPort,
  externalUrl,
  samlPath,
  samlAudience,
  preLoadedConfig,
  apiKeys,
  idpEnabled,
  db,
  clientSecretVerifier,
};
