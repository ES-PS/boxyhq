import type {
  IAdminController,
  IConnectionAPIController,
  SAMLSSOConnectionWithEncodedMetadata,
  SAMLSSOConnectionWithRawMetadata,
  OIDCSSOConnection,
  ILogoutController,
  IOAuthController,
  IHealthCheckController,
  ISetupLinkController,
  IDirectorySyncController,
  DirectoryType,
  Directory,
  User,
  Group,
  DirectorySyncEvent,
  HTTPMethod,
  DirectorySyncRequest,
  IOidcDiscoveryController,
  ISPSAMLConfig,
  GetConnectionsQuery,
  GetIDPEntityIDBody,
  GetConfigQuery,
} from '@boxyhq/saml-jackson';

import jackson from '@boxyhq/saml-jackson';
import { jacksonOptions } from '@lib/env';
import '@lib/metrics';

let connectionAPIController: IConnectionAPIController;
let oauthController: IOAuthController;
let adminController: IAdminController;
let logoutController: ILogoutController;
let healthCheckController: IHealthCheckController;
let setupLinkController: ISetupLinkController;
let directorySyncController: IDirectorySyncController;
let oidcDiscoveryController: IOidcDiscoveryController;
let spConfig: ISPSAMLConfig;

const g = global as any;

export default async function init() {
  if (
    !g.connectionAPIController ||
    !g.oauthController ||
    !g.adminController ||
    !g.healthCheckController ||
    !g.logoutController ||
    !g.directorySync ||
    !g.setupLinkController ||
    !g.oidcDiscoveryController ||
    !g.spConfig
  ) {
    const ret = await jackson(jacksonOptions);
    connectionAPIController = ret.connectionAPIController;
    oauthController = ret.oauthController;
    adminController = ret.adminController;
    logoutController = ret.logoutController;
    healthCheckController = ret.healthCheckController;
    setupLinkController = ret.setupLinkController;
    directorySyncController = ret.directorySyncController;
    oidcDiscoveryController = ret.oidcDiscoveryController;
    spConfig = ret.spConfig;

    g.connectionAPIController = connectionAPIController;
    g.oauthController = oauthController;
    g.adminController = adminController;
    g.logoutController = logoutController;
    g.healthCheckController = healthCheckController;
    g.directorySync = directorySyncController;
    g.setupLinkController = setupLinkController;
    g.oidcDiscoveryController = oidcDiscoveryController;
    g.spConfig = spConfig;
    g.isJacksonReady = true;
  } else {
    connectionAPIController = g.connectionAPIController;
    oauthController = g.oauthController;
    adminController = g.adminController;
    logoutController = g.logoutController;
    healthCheckController = g.healthCheckController;
    directorySyncController = g.directorySync;
    oidcDiscoveryController = g.oidcDiscoveryController;
    setupLinkController = g.setupLinkController;
    spConfig = g.spConfig;
  }

  return {
    spConfig,
    connectionAPIController,
    oauthController,
    adminController,
    logoutController,
    healthCheckController,
    directorySyncController,
    oidcDiscoveryController,
    setupLinkController,
  };
}

export type {
  SAMLSSOConnectionWithEncodedMetadata,
  SAMLSSOConnectionWithRawMetadata,
  OIDCSSOConnection,
  DirectoryType,
  Directory,
  User,
  Group,
  DirectorySyncEvent,
  HTTPMethod,
  DirectorySyncRequest,
  GetConnectionsQuery,
  GetIDPEntityIDBody,
  GetConfigQuery,
};
