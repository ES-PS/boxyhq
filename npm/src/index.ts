import type { IDirectorySyncController, JacksonOption } from './typings';
import DB from './db/db';
import defaultDb from './db/defaultDb';
import loadConnection from './loadConnection';
import { init as metricsInit } from './opentelemetry/metrics';
import { AdminController } from './controller/admin';
import { ConnectionAPIController } from './controller/api';
import { OAuthController } from './controller/oauth';
import { HealthCheckController } from './controller/health-check';
import { LogoutController } from './controller/logout';
import initDirectorySync from './directory-sync';
import { OidcDiscoveryController } from './controller/oidc-discovery';
import { SPSAMLConfig } from './controller/sp-config';
import { SetupLinkController } from './controller/setup-link';
import { AnalyticsController } from './controller/analytics';
import * as x509 from './saml/x509';
import initFederatedSAML, { type ISAMLFederationController } from './ee/federated-saml';
import checkLicense from './ee/common/checkLicense';
import { BrandingController } from './ee/branding';

const defaultOpts = (opts: JacksonOption): JacksonOption => {
  const newOpts = {
    ...opts,
  };

  if (!newOpts.externalUrl) {
    throw new Error('externalUrl is required');
  }

  if (!newOpts.samlPath) {
    throw new Error('samlPath is required');
  }

  newOpts.scimPath = newOpts.scimPath || '/api/scim/v2.0';

  newOpts.samlAudience = newOpts.samlAudience || 'https://saml.boxyhq.com';
  // path to folder containing static IdP connections that will be preloaded. This is useful for self-hosted deployments that only have to support a single tenant (or small number of known tenants).
  newOpts.preLoadedConnection = newOpts.preLoadedConnection || '';
  newOpts.preLoadedConfig = newOpts.preLoadedConfig || ''; // for backwards compatibility

  newOpts.idpEnabled = newOpts.idpEnabled === true;
  defaultDb(newOpts);

  newOpts.clientSecretVerifier = newOpts.clientSecretVerifier || 'dummy';
  newOpts.db.pageLimit = newOpts.db.pageLimit || 50;

  newOpts.openid = newOpts.openid || {};
  newOpts.openid.jwsAlg = newOpts.openid.jwsAlg || 'RS256';

  newOpts.boxyhqLicenseKey = newOpts.boxyhqLicenseKey || undefined;

  return newOpts;
};

export const controllers = async (
  opts: JacksonOption
): Promise<{
  apiController: ConnectionAPIController;
  connectionAPIController: ConnectionAPIController;
  oauthController: OAuthController;
  adminController: AdminController;
  logoutController: LogoutController;
  healthCheckController: HealthCheckController;
  setupLinkController: SetupLinkController;
  directorySyncController: IDirectorySyncController;
  oidcDiscoveryController: OidcDiscoveryController;
  spConfig: SPSAMLConfig;
  samlFederatedController: ISAMLFederationController;
  brandingController: IBrandingController | null;
  checkLicense: () => Promise<boolean>;
}> => {
  opts = defaultOpts(opts);

  metricsInit();

  const db = await DB.new(opts.db);

  const connectionStore = db.store('saml:config');
  const sessionStore = db.store('oauth:session', opts.db.ttl);
  const codeStore = db.store('oauth:code', opts.db.ttl);
  const tokenStore = db.store('oauth:token', opts.db.ttl);
  const healthCheckStore = db.store('_health:check');
  const setupLinkStore = db.store('setup:link');
  const certificateStore = db.store('x509:certificates');
  const settingsStore = db.store('portal:settings');

  const connectionAPIController = new ConnectionAPIController({ connectionStore, opts });
  const adminController = new AdminController({ connectionStore });
  const healthCheckController = new HealthCheckController({ healthCheckStore });
  await healthCheckController.init();
  const setupLinkController = new SetupLinkController({ setupLinkStore });

  if (!opts.noAnalytics) {
    console.info(
      'Anonymous analytics enabled. You can disable this by setting the DO_NOT_TRACK=1 or BOXYHQ_NO_ANALYTICS=1 environment variables'
    );
    const analyticsStore = db.store('_analytics:events');
    const analyticsController = new AnalyticsController({ analyticsStore });
    await analyticsController.init();
  }

  // Create default certificate if it doesn't exist.
  await x509.init(certificateStore, opts);

  const oauthController = new OAuthController({
    connectionStore,
    sessionStore,
    codeStore,
    tokenStore,
    opts,
  });

  const logoutController = new LogoutController({
    connectionStore,
    sessionStore,
    opts,
  });

  const oidcDiscoveryController = new OidcDiscoveryController({ opts });
  const spConfig = new SPSAMLConfig(opts);
  const directorySyncController = await initDirectorySync({ db, opts });

  // Enterprise Features
  const samlFederatedController = await initFederatedSAML({ db, opts });
  const brandingController = (await checkLicense(opts.boxyhqLicenseKey))
    ? new BrandingController({ store: settingsStore })
    : null;

  // write pre-loaded connections if present
  const preLoadedConnection = opts.preLoadedConnection || opts.preLoadedConfig;
  if (preLoadedConnection && preLoadedConnection.length > 0) {
    const connections = await loadConnection(preLoadedConnection);

    for (const connection of connections) {
      if ('oidcDiscoveryUrl' in connection || 'oidcMetadata' in connection) {
        await connectionAPIController.createOIDCConnection(connection);
      } else {
        await connectionAPIController.createSAMLConnection(connection);
      }

      console.info(`loaded connection for tenant "${connection.tenant}" and product "${connection.product}"`);
    }
  }

  const type = opts.db.engine === 'sql' && opts.db.type ? ' Type: ' + opts.db.type : '';

  console.info(`Using engine: ${opts.db.engine}.${type}`);

  return {
    spConfig,
    apiController: connectionAPIController,
    connectionAPIController,
    oauthController,
    adminController,
    logoutController,
    healthCheckController,
    setupLinkController,
    directorySyncController,
    oidcDiscoveryController,
    samlFederatedController,
    brandingController,
    checkLicense: () => {
      return checkLicense(opts.boxyhqLicenseKey);
    },
  };
};

export default controllers;

export * from './typings';
export * from './ee/federated-saml/types';
export type SAMLJackson = Awaited<ReturnType<typeof controllers>>;
export type ISetupLinkController = InstanceType<typeof SetupLinkController>;
export type IBrandingController = InstanceType<typeof BrandingController>;
