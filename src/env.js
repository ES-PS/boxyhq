const hostUrl = process.env.HOST_URL || 'localhost';
const hostPort = (process.env.HOST_PORT || '5000') * 1;
const externalUrl =
  process.env.EXTERNAL_URL || 'http://' + hostUrl + ':' + hostPort;
const samlAudience = process.env.SAML_AUDIENCE || 'https://auth.boxyhq.com';

const internalUrl = process.env.INTERNAL_HOST_URL || 'localhost';
const internalPort = (process.env.INTERNAL_HOST_PORT || '6000') * 1;

const idpEnabled = process.env.IDP_ENABLED === 'true';

const dbEngine = process.env.DB_ENGINE || 'redis';
const dbUrl = process.env.DB_URL;
const dbUserName = process.env.DB_USER_NAME;
const dbUserPassword = process.env.DB_USER_PASSWORD;

module.exports = {
  hostUrl,
  hostPort,
  externalUrl,
  samlAudience,
  internalUrl,
  internalPort,
  idpEnabled,
  dbEngine,
  dbUrl,
  dbUserName,
  dbUserPassword,
  useInternalServer: !(hostUrl === internalUrl && hostPort === internalPort),
};
