import crypto from 'crypto';
import * as jose from 'jose';
import { promisify } from 'util';
import { deflateRaw } from 'zlib';
import saml from '@boxyhq/saml20';
import { errors, generators, Issuer } from 'openid-client';
import { SAMLProfile } from '@boxyhq/saml20/dist/typings';

import type {
  OIDCAuthzResponsePayload,
  IOAuthController,
  JacksonOption,
  OAuthReq,
  OAuthTokenReq,
  OAuthTokenRes,
  Profile,
  SAMLResponsePayload,
  Storable,
  SAMLSSORecord,
  OIDCSSORecord,
} from '../typings';
import {
  relayStatePrefix,
  IndexNames,
  OAuthErrorResponse,
  getErrorMessage,
  loadJWSPrivateKey,
  isJWSKeyPairLoaded,
  extractOIDCUserProfile,
  getScopeValues,
  getEncodedTenantProduct,
} from './utils';

import * as metrics from '../opentelemetry/metrics';
import { JacksonError } from './error';
import * as allowed from './oauth/allowed';
import * as codeVerifier from './oauth/code-verifier';
import * as redirect from './oauth/redirect';
import { getDefaultCertificate } from '../saml/x509';
import { SAMLHandler } from './saml-handler';
import { extractSAMLResponseAttributes } from '../saml/lib';

const deflateRawAsync = promisify(deflateRaw);

export class OAuthController implements IOAuthController {
  private connectionStore: Storable;
  private sessionStore: Storable;
  private codeStore: Storable;
  private tokenStore: Storable;
  private opts: JacksonOption;
  private samlHandler: SAMLHandler;

  constructor({ connectionStore, sessionStore, codeStore, tokenStore, opts }) {
    this.connectionStore = connectionStore;
    this.sessionStore = sessionStore;
    this.codeStore = codeStore;
    this.tokenStore = tokenStore;
    this.opts = opts;

    this.samlHandler = new SAMLHandler({
      connection: connectionStore,
      session: sessionStore,
      opts,
    });
  }

  public async authorize(body: OAuthReq): Promise<{ redirect_url?: string; authorize_form?: string }> {
    const {
      response_type = 'code',
      client_id,
      redirect_uri,
      state,
      scope,
      nonce,
      code_challenge,
      code_challenge_method = '',
      idp_hint,
      forceAuthn = 'false',
    } = body;

    const tenant = 'tenant' in body ? body.tenant : undefined;
    const product = 'product' in body ? body.product : undefined;
    const access_type = 'access_type' in body ? body.access_type : undefined;
    const resource = 'resource' in body ? body.resource : undefined;

    let requestedTenant = tenant;
    let requestedProduct = product;

    metrics.increment('oauthAuthorize');

    if (!redirect_uri) {
      throw new JacksonError('Please specify a redirect URL.', 400);
    }

    let connection: SAMLSSORecord | OIDCSSORecord | undefined;
    const requestedScopes = getScopeValues(scope);
    const requestedOIDCFlow = requestedScopes.includes('openid');

    if (tenant && product) {
      const response = await this.samlHandler.resolveConnection({
        tenant,
        product,
        idp_hint,
        authFlow: 'oauth',
        originalParams: { ...body },
      });

      if ('redirectUrl' in response) {
        return {
          redirect_url: response.redirectUrl,
        };
      }

      if ('connection' in response) {
        connection = response.connection;
      }
    } else if (client_id && client_id !== '' && client_id !== 'undefined' && client_id !== 'null') {
      // if tenant and product are encoded in the client_id then we parse it and check for the relevant connection(s)
      let sp = getEncodedTenantProduct(client_id);

      if (!sp && access_type) {
        sp = getEncodedTenantProduct(access_type);
      }
      if (!sp && resource) {
        sp = getEncodedTenantProduct(resource);
      }
      if (!sp && requestedScopes) {
        const encodedParams = requestedScopes.find((scope) => scope.includes('=') && scope.includes('&')); // for now assume only one encoded param i.e. for tenant/product
        if (encodedParams) {
          sp = getEncodedTenantProduct(encodedParams);
        }
      }
      if (sp && sp.tenant && sp.product) {
        const { tenant, product } = sp;

        requestedTenant = tenant;
        requestedProduct = product;

        const response = await this.samlHandler.resolveConnection({
          tenant,
          product,
          idp_hint,
          authFlow: 'oauth',
          originalParams: { ...body },
        });

        if ('redirectUrl' in response) {
          return {
            redirect_url: response.redirectUrl,
          };
        }

        if ('connection' in response) {
          connection = response.connection;
        }
      } else {
        connection = await this.connectionStore.get(client_id);
        if (connection) {
          requestedTenant = connection.tenant;
          requestedProduct = connection.product;
        }
      }
    } else {
      throw new JacksonError('You need to specify client_id or tenant & product', 403);
    }

    if (!connection) {
      throw new JacksonError('IdP connection not found.', 403);
    }

    if (!allowed.redirect(redirect_uri, connection.redirectUrl as string[])) {
      throw new JacksonError('Redirect URL is not allowed.', 403);
    }

    if (
      requestedOIDCFlow &&
      (!this.opts.openid?.jwtSigningKeys || !isJWSKeyPairLoaded(this.opts.openid.jwtSigningKeys))
    ) {
      return {
        redirect_url: OAuthErrorResponse({
          error: 'server_error',
          error_description:
            'OAuth server not configured correctly for openid flow, check if JWT signing keys are loaded',
          redirect_uri,
        }),
      };
    }

    if (!state) {
      return {
        redirect_url: OAuthErrorResponse({
          error: 'invalid_request',
          error_description: 'Please specify a state to safeguard against XSRF attacks',
          redirect_uri,
        }),
      };
    }

    if (response_type !== 'code') {
      return {
        redirect_url: OAuthErrorResponse({
          error: 'unsupported_response_type',
          error_description: 'Only Authorization Code grant is supported',
          redirect_uri,
          state,
        }),
      };
    }

    // Connection retrieved: Handover to IdP starts here
    let ssoUrl;
    let post = false;
    const connectionIsSAML = 'idpMetadata' in connection && connection.idpMetadata !== undefined;
    const connectionIsOIDC = 'oidcProvider' in connection && connection.oidcProvider !== undefined;

    // Init sessionId
    const sessionId = crypto.randomBytes(16).toString('hex');
    const relayState = relayStatePrefix + sessionId;
    // SAML connection: SAML request will be constructed here
    let samlReq;
    if ('idpMetadata' in connection) {
      const { sso } = connection.idpMetadata;

      if ('redirectUrl' in sso) {
        // HTTP Redirect binding
        ssoUrl = sso.redirectUrl;
      } else if ('postUrl' in sso) {
        // HTTP-POST binding
        ssoUrl = sso.postUrl;
        post = true;
      } else {
        // This code here is kept for backward compatibility. We now have validation while adding the SSO connection to ensure binding is present.
        return {
          redirect_url: OAuthErrorResponse({
            error: 'invalid_request',
            error_description: 'SAML binding could not be retrieved',
            redirect_uri,
            state,
          }),
        };
      }

      const cert = await getDefaultCertificate();

      try {
        samlReq = saml.request({
          ssoUrl,
          entityID: this.opts.samlAudience!,
          callbackUrl: this.opts.externalUrl + this.opts.samlPath,
          signingKey: cert.privateKey,
          publicKey: cert.publicKey,
          forceAuthn: forceAuthn === 'true' ? true : !!connection.forceAuthn,
        });
      } catch (err: unknown) {
        return {
          redirect_url: OAuthErrorResponse({
            error: 'server_error',
            error_description: getErrorMessage(err),
            redirect_uri,
            state,
          }),
        };
      }
    }

    // OIDC Connection: Issuer discovery, openid-client init and extraction of authorization endpoint happens here
    let oidcCodeVerifier: string | undefined;
    if (connectionIsOIDC && 'oidcProvider' in connection) {
      if (!this.opts.oidcPath) {
        return {
          redirect_url: OAuthErrorResponse({
            error: 'server_error',
            error_description: 'OpenID response handler path (oidcPath) is not set',
            redirect_uri,
            state,
          }),
        };
      }
      const { discoveryUrl, clientId, clientSecret } = connection.oidcProvider;
      try {
        const oidcIssuer = await Issuer.discover(discoveryUrl as string);
        const oidcClient = new oidcIssuer.Client({
          client_id: clientId as string,
          client_secret: clientSecret,
          redirect_uris: [this.opts.externalUrl + this.opts.oidcPath],
          response_types: ['code'],
        });
        oidcCodeVerifier = generators.codeVerifier();
        const code_challenge = generators.codeChallenge(oidcCodeVerifier);
        ssoUrl = oidcClient.authorizationUrl({
          scope: [...requestedScopes, 'openid', 'email', 'profile']
            .filter((value, index, self) => self.indexOf(value) === index) // filter out duplicates
            .join(' '),
          code_challenge,
          code_challenge_method: 'S256',
          state: relayState,
        });
      } catch (err: unknown) {
        if (err) {
          return {
            redirect_url: OAuthErrorResponse({
              error: 'server_error',
              error_description: (err as errors.OPError)?.error || getErrorMessage(err),
              redirect_uri,
              state,
            }),
          };
        }
      }
    }
    // Session persistence happens here
    try {
      const requested = { client_id, state, redirect_uri } as Record<string, string | boolean | string[]>;
      if (requestedTenant) {
        requested.tenant = requestedTenant;
      }
      if (requestedProduct) {
        requested.product = requestedProduct;
      }
      if (idp_hint) {
        requested.idp_hint = idp_hint;
      }
      if (requestedOIDCFlow) {
        requested.oidc = true;
        if (nonce) {
          requested.nonce = nonce;
        }
      }
      if (requestedScopes) {
        requested.scope = requestedScopes;
      }

      const sessionObj = {
        redirect_uri,
        response_type,
        state,
        code_challenge,
        code_challenge_method,
        requested,
      };
      await this.sessionStore.put(
        sessionId,
        connectionIsSAML
          ? {
              ...sessionObj,
              id: samlReq?.id,
            }
          : { ...sessionObj, id: connection.clientID, oidcCodeVerifier }
      );
      // Redirect to IdP
      if (connectionIsSAML) {
        let redirectUrl;
        let authorizeForm;

        if (!post) {
          // HTTP Redirect binding
          redirectUrl = redirect.success(ssoUrl, {
            RelayState: relayState,
            SAMLRequest: Buffer.from(await deflateRawAsync(samlReq.request)).toString('base64'),
          });
        } else {
          // HTTP POST binding
          authorizeForm = saml.createPostForm(ssoUrl, [
            {
              name: 'RelayState',
              value: relayState,
            },
            {
              name: 'SAMLRequest',
              value: Buffer.from(samlReq.request).toString('base64'),
            },
          ]);
        }
        return {
          redirect_url: redirectUrl,
          authorize_form: authorizeForm,
        };
      } else if (connectionIsOIDC) {
        return { redirect_url: ssoUrl };
      } else {
        return {
          redirect_url: OAuthErrorResponse({
            error: 'invalid_request',
            error_description: 'Connection appears to be misconfigured',
            redirect_uri,
            state,
          }),
        };
      }
    } catch (err: unknown) {
      return {
        redirect_url: OAuthErrorResponse({
          error: 'server_error',
          error_description: getErrorMessage(err),
          redirect_uri,
          state,
        }),
      };
    }
  }

  public async samlResponse(
    body: SAMLResponsePayload
  ): Promise<{ redirect_url?: string; app_select_form?: string; responseForm?: string }> {
    const { SAMLResponse, idp_hint, RelayState = '' } = body;

    const isIdPFlow = !RelayState.startsWith(relayStatePrefix);

    // IdP is disabled so block the request
    if (!this.opts.idpEnabled && isIdPFlow) {
      // IdP login is disabled so block the request
      throw new JacksonError(
        'IdP (Identity Provider) flow has been disabled. Please head to your Service Provider to login.',
        403
      );
    }

    const sessionId = RelayState.replace(relayStatePrefix, '');
    const rawResponse = Buffer.from(SAMLResponse, 'base64').toString();
    const issuer = saml.parseIssuer(rawResponse);

    if (!issuer) {
      throw new JacksonError('Issuer not found.', 403);
    }

    const connections: SAMLSSORecord[] = await this.connectionStore.getByIndex({
      name: IndexNames.EntityID,
      value: issuer,
    });

    if (!connections || connections.length === 0) {
      throw new JacksonError('SAML connection not found.', 403);
    }

    const session = sessionId ? await this.sessionStore.get(sessionId) : null;

    if (!isIdPFlow && !session) {
      throw new JacksonError('Unable to validate state from the origin request.', 403);
    }

    const isSAMLFederated = session && 'samlFederated' in session;
    const isSPFflow = !isIdPFlow && !isSAMLFederated;

    let connection: SAMLSSORecord | undefined;

    // IdP initiated SSO flow
    if (isIdPFlow) {
      const response = await this.samlHandler.resolveConnection({
        idp_hint,
        authFlow: 'idp-initiated',
        entityId: issuer,
        originalParams: {
          SAMLResponse,
        },
      });

      // Redirect to the product selection page
      if ('postForm' in response) {
        return {
          app_select_form: response.postForm,
        };
      }

      // Found a connection
      if ('connection' in response) {
        connection = response.connection as SAMLSSORecord;
      }
    }

    // SP initiated SSO flow
    // Resolve if there are multiple matches for SP login
    if (isSPFflow) {
      connection = connections.filter((c) => {
        return (
          c.clientID === session.requested.client_id ||
          (c.tenant === session.requested.tenant && c.product === session.requested.product)
        );
      })[0];
    }

    if (!connection) {
      connection = connections[0];
    }

    if (!connection) {
      throw new JacksonError('SAML connection not found.', 403);
    }

    if (
      session &&
      session.redirect_uri &&
      !allowed.redirect(session.redirect_uri, connection.redirectUrl as string[])
    ) {
      throw new JacksonError('Redirect URL is not allowed.', 403);
    }

    const { privateKey } = await getDefaultCertificate();

    const validateOpts = {
      thumbprint: `${connection.idpMetadata.thumbprint}`,
      audience: `${this.opts.samlAudience}`,
      privateKey,
    };

    if (session && session.id) {
      validateOpts['inResponseTo'] = session.id;
    }

    const redirect_uri = (session && session.redirect_uri) || connection.defaultRedirectUrl;

    let profile: SAMLProfile | null = null;

    try {
      profile = await extractSAMLResponseAttributes(rawResponse, validateOpts);
    } catch (err: unknown) {
      return {
        redirect_url: OAuthErrorResponse({
          error: 'access_denied',
          error_description: getErrorMessage(err),
          redirect_uri,
          state: session.requested?.state,
        }),
      };
    }

    // This is a federated SAML flow, let's create a new SAMLResponse and POST it to the SP
    if (isSAMLFederated) {
      const { responseForm } = await this.samlHandler.createSAMLResponse({ profile, session });

      await this.sessionStore.delete(sessionId);

      return { responseForm };
    }

    const code = await this._buildAuthorizationCode(connection, profile, session, isIdPFlow);

    const params = {
      code,
    };

    if (session && session.state) {
      params['state'] = session.state;
    }

    await this.sessionStore.delete(sessionId);

    return { redirect_url: redirect.success(redirect_uri, params) };
  }

  public async oidcAuthzResponse(body: OIDCAuthzResponsePayload): Promise<{ redirect_url?: string }> {
    const { code: opCode, state, error, error_description } = body;

    let RelayState = state || '';
    if (!RelayState) {
      throw new JacksonError('State from original request is missing.', 403);
    }

    RelayState = RelayState.replace(relayStatePrefix, '');
    const session = await this.sessionStore.get(RelayState);
    if (!session) {
      throw new JacksonError('Unable to validate state from the original request.', 403);
    }

    const oidcConnection = await this.connectionStore.get(session.id);

    if (session.redirect_uri && !allowed.redirect(session.redirect_uri, oidcConnection.redirectUrl)) {
      throw new JacksonError('Redirect URL is not allowed.', 403);
    }
    const redirect_uri = (session && session.redirect_uri) || oidcConnection.defaultRedirectUrl;

    if (error) {
      return {
        redirect_url: OAuthErrorResponse({
          error,
          error_description: error_description ?? 'Authorization failure at OIDC Provider',
          redirect_uri,
          state: session.state,
        }),
      };
    }

    if (!opCode) {
      return {
        redirect_url: OAuthErrorResponse({
          error: 'server_error',
          error_description: 'Authorization code could not be retrieved from OIDC Provider',
          redirect_uri,
          state: session.state,
        }),
      };
    }

    // Reconstruct the oidcClient
    const { discoveryUrl, clientId, clientSecret } = oidcConnection.oidcProvider;
    let profile;
    try {
      const oidcIssuer = await Issuer.discover(discoveryUrl);
      const oidcClient = new oidcIssuer.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [this.opts.externalUrl + this.opts.oidcPath],
        response_types: ['code'],
      });
      const tokenSet = await oidcClient.callback(
        this.opts.externalUrl + this.opts.oidcPath,
        {
          code: opCode,
        },
        { code_verifier: session.oidcCodeVerifier }
      );
      profile = await extractOIDCUserProfile(tokenSet, oidcClient);
    } catch (err: unknown) {
      if (err) {
        return {
          redirect_url: OAuthErrorResponse({
            error: 'server_error',
            error_description: (err as errors.OPError)?.error || getErrorMessage(err),
            redirect_uri,
            state: session.state,
          }),
        };
      }
    }

    const code = await this._buildAuthorizationCode(oidcConnection, profile, session, false);

    const params = {
      code,
    };

    if (session && session.state) {
      params['state'] = session.state;
    }

    const redirectUrl = redirect.success(redirect_uri, params);

    await this.sessionStore.delete(RelayState);

    return { redirect_url: redirectUrl };
  }

  // Build the authorization code for the session
  private async _buildAuthorizationCode(
    connection: SAMLSSORecord | OIDCSSORecord,
    profile: any,
    session: any,
    isIdPFlow: boolean
  ) {
    // Store details against a code
    const code = crypto.randomBytes(20).toString('hex');

    const codeVal = {
      profile,
      clientID: connection.clientID,
      clientSecret: connection.clientSecret,
      requested: session ? session.requested : null,
      isIdPFlow,
    };

    if (session) {
      codeVal['session'] = session;
    }

    await this.codeStore.put(code, codeVal);

    return code;
  }

  /**
   * @swagger
   *
   * /oauth/token:
   *   post:
   *     summary: Code exchange
   *     operationId: oauth-code-exchange
   *     tags:
   *       - OAuth
   *     consumes:
   *       - application/x-www-form-urlencoded
   *     parameters:
   *       - name: grant_type
   *         in: formData
   *         type: string
   *         description: Grant type should be 'authorization_code'
   *         default: authorization_code
   *         required: true
   *       - name: client_id
   *         in: formData
   *         type: string
   *         description: Use the client_id returned by the SAML connection API
   *         required: true
   *       - name: client_secret
   *         in: formData
   *         type: string
   *         description: Use the client_secret returned by the SAML connection API
   *         required: true
   *       - name: code_verifier
   *         in: formData
   *         type: string
   *         description: code_verifier against the code_challenge in the authz request (relevant to PKCE flow)
   *       - name: redirect_uri
   *         in: formData
   *         type: string
   *         description: Redirect URI
   *         required: true
   *       - name: code
   *         in: formData
   *         type: string
   *         description: Code
   *         required: true
   *     responses:
   *       '200':
   *         description: Success
   *         schema:
   *           type: object
   *           properties:
   *             access_token:
   *               type: string
   *             token_type:
   *               type: string
   *             expires_in:
   *               type: string
   *           example:
   *             access_token: 8958e13053832b5af58fdf2ee83f35f5d013dc74
   *             token_type: bearer
   *             expires_in: 300
   */
  public async token(body: OAuthTokenReq): Promise<OAuthTokenRes> {
    const { code, grant_type = 'authorization_code', redirect_uri } = body;
    const client_id = 'client_id' in body ? body.client_id : undefined;
    const client_secret = 'client_secret' in body ? body.client_secret : undefined;
    const code_verifier = 'code_verifier' in body ? body.code_verifier : undefined;

    metrics.increment('oauthToken');

    if (grant_type !== 'authorization_code') {
      throw new JacksonError('Unsupported grant_type', 400);
    }

    if (!code) {
      throw new JacksonError('Please specify code', 400);
    }

    const codeVal = await this.codeStore.get(code);
    if (!codeVal || !codeVal.profile) {
      throw new JacksonError('Invalid code', 403);
    }

    if (codeVal.requested?.redirect_uri) {
      if (redirect_uri !== codeVal.requested.redirect_uri) {
        throw new JacksonError(
          `Invalid request: ${!redirect_uri ? 'redirect_uri missing' : 'redirect_uri mismatch'}`,
          400
        );
      }
    }

    if (code_verifier) {
      // PKCE flow
      let cv = code_verifier;
      if (codeVal.session.code_challenge_method?.toLowerCase() === 's256') {
        cv = codeVerifier.encode(code_verifier);
      }

      if (codeVal.session.code_challenge !== cv) {
        throw new JacksonError('Invalid code_verifier', 401);
      }
    } else if (client_id && client_secret) {
      // check if we have an encoded client_id
      if (client_id !== 'dummy') {
        const sp = getEncodedTenantProduct(client_id);
        if (!sp) {
          // OAuth flow
          if (client_id !== codeVal.clientID || client_secret !== codeVal.clientSecret) {
            throw new JacksonError('Invalid client_id or client_secret', 401);
          }
        } else {
          if (
            !codeVal.isIdPFlow &&
            (sp.tenant !== codeVal.requested?.tenant || sp.product !== codeVal.requested?.product)
          ) {
            throw new JacksonError('Invalid tenant or product', 401);
          }
          // encoded client_id, verify client_secret
          if (client_secret !== this.opts.clientSecretVerifier) {
            throw new JacksonError('Invalid client_secret', 401);
          }
        }
      } else {
        if (client_secret !== this.opts.clientSecretVerifier && client_secret !== codeVal.clientSecret) {
          throw new JacksonError('Invalid client_secret', 401);
        }
      }
    } else if (codeVal && codeVal.session) {
      throw new JacksonError('Please specify client_secret or code_verifier', 401);
    }

    // store details against a token
    const token = crypto.randomBytes(20).toString('hex');

    const tokenVal = {
      ...codeVal.profile,
      requested: codeVal.requested,
    };
    const requestedOIDCFlow = !!codeVal.requested?.oidc;
    const requestHasNonce = !!codeVal.requested?.nonce;
    if (requestedOIDCFlow) {
      const { jwtSigningKeys, jwsAlg } = this.opts.openid ?? {};
      if (!jwtSigningKeys || !isJWSKeyPairLoaded(jwtSigningKeys)) {
        throw new JacksonError('JWT signing keys are not loaded', 500);
      }
      let claims: Record<string, string> = requestHasNonce ? { nonce: codeVal.requested.nonce } : {};
      claims = {
        ...claims,
        id: codeVal.profile.claims.id,
        email: codeVal.profile.claims.email,
        firstName: codeVal.profile.claims.firstName,
        lastName: codeVal.profile.claims.lastName,
        roles: codeVal.profile.claims.roles,
        groups: codeVal.profile.claims.groups,
      };
      const signingKey = await loadJWSPrivateKey(jwtSigningKeys.private, jwsAlg!);
      const id_token = await new jose.SignJWT(claims)
        .setProtectedHeader({ alg: jwsAlg! })
        .setIssuedAt()
        .setIssuer(this.opts.samlAudience || '')
        .setSubject(codeVal.profile.claims.id)
        .setAudience(tokenVal.requested.client_id)
        .setExpirationTime(`${this.opts.db.ttl}s`) //  identity token only really needs to be valid long enough for it to be verified by the client application.
        .sign(signingKey);
      tokenVal.id_token = id_token;
      tokenVal.claims.sub = codeVal.profile.claims.id;
    }

    await this.tokenStore.put(token, tokenVal);

    // delete the code
    try {
      await this.codeStore.delete(code);
    } catch (_err) {
      // ignore error
    }

    const tokenResponse: OAuthTokenRes = {
      access_token: token,
      token_type: 'bearer',
      expires_in: this.opts.db.ttl!,
    };

    if (requestedOIDCFlow) {
      tokenResponse.id_token = tokenVal.id_token;
    }

    return tokenResponse;
  }

  /**
   * @swagger
   *
   * /oauth/userinfo:
   *   get:
   *     summary: Get profile
   *     operationId: oauth-get-profile
   *     tags:
   *       - OAuth
   *     responses:
   *       '200':
   *         description: Success
   *         schema:
   *           type: object
   *           properties:
   *             id:
   *               type: string
   *             email:
   *               type: string
   *             firstName:
   *               type: string
   *             lastName:
   *               type: string
   *             roles:
   *               type: array
   *             groups:
   *               type: array
   *             raw:
   *               type: object
   *             requested:
   *               type: object
   *           example:
   *             id: 32b5af58fdf
   *             email: jackson@coolstartup.com
   *             firstName: SAML
   *             lastName: Jackson
   *             raw: {
   *
   *             }
   *             requested: {
   *
   *             }
   */
  public async userInfo(token: string): Promise<Profile> {
    const rsp = await this.tokenStore.get(token);

    metrics.increment('oauthUserInfo');

    if (!rsp || !rsp.claims) {
      throw new JacksonError('Invalid token', 403);
    }

    return {
      ...rsp.claims,
      requested: rsp.requested,
    };
  }
}
