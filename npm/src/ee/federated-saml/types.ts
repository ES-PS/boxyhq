import SAMLFederation from '.';

export type ISAMLFederationController = Awaited<ReturnType<typeof SAMLFederation>>;

export type SAMLFederationApp = {
  id: string;
  name: string;
  tenant: string;
  product: string;
  acsUrl: string;
  entityId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
};

export type SAMLFederationAppWithMetadata = SAMLFederationApp & {
  metadata: {
    entityId: string;
    ssoUrl: string;
    x509cert: string;
    xml: string;
  };
};

export type DeleteAppParams =
  | {
      id: string;
    }
  | {
      tenant: string;
      product: string;
    };

export type GetAppParams =
  | {
      id: string;
    }
  | {
      tenant: string;
      product: string;
    };
