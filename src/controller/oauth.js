const crypto = require('crypto');

const saml = require('../saml/saml.js');
const codeVerifier = require('./oauth/code-verifier.js');
const { indexNames, extractAuthToken } = require('./utils.js');
const dbutils = require('../db/utils.js');
const redirect = require('./oauth/redirect.js');
const allowed = require('./oauth/allowed.js');

let configStore;
let sessionStore;
let codeStore;
let tokenStore;
let options;

const relayStatePrefix = 'boxyhq_jackson_';

function getEncodedClientId(client_id) {
  try {
    const sp = new URLSearchParams(client_id);
    const tenant = sp.get('tenant');
    const product = sp.get('product');
    if (tenant && product) {
      return {
        tenant: sp.get('tenant'),
        product: sp.get('product'),
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

const authorize = async (req, res) => {
  const {
    response_type = 'code',
    client_id,
    redirect_uri,
    state,
    tenant,
    product,
    code_challenge,
    code_challenge_method = '',
    // eslint-disable-next-line no-unused-vars
    provider = 'saml',
  } = req.query;

  if (!redirect_uri) {
    return res.status(400).send('Please specify a redirect URL.');
  }

  if (!state) {
    return res
      .status(400)
      .send('Please specify a state to safeguard against XSRF attacks.');
  }

  let samlConfig;

  if (
    client_id &&
    client_id !== '' &&
    client_id !== 'undefined' &&
    client_id !== 'null'
  ) {
    // if tenant and product are encoded in the client_id then we parse it and check for the relevant config(s)
    const sp = getEncodedClientId(client_id);
    if (sp) {
      const samlConfigs = await configStore.getByIndex({
        name: indexNames.tenantProduct,
        value: dbutils.keyFromParts(sp.tenant, sp.product),
      });

      if (!samlConfigs || samlConfigs.length === 0) {
        return res.status(403).send('SAML configuration not found.');
      }

      // TODO: Support multiple matches
      samlConfig = samlConfigs[0];
    } else {
      samlConfig = await configStore.get(client_id);
    }
  } else {
    const samlConfigs = await configStore.getByIndex({
      name: indexNames.tenantProduct,
      value: dbutils.keyFromParts(tenant, product),
    });

    if (!samlConfigs || samlConfigs.length === 0) {
      return res.status(403).send('SAML configuration not found.');
    }

    // TODO: Support multiple matches
    samlConfig = samlConfigs[0];
  }

  if (!samlConfig) {
    return res.status(403).send('SAML configuration not found.');
  }

  if (!allowed.redirect(redirect_uri, samlConfig.redirectUrl)) {
    return res.status(403).send('Redirect URL is not allowed.');
  }

  const samlReq = saml.request({
    entityID: options.samlAudience,
    callbackUrl: options.externalUrl + options.samlPath,
    signingKey: samlConfig.certs.privateKey,
  });

  const sessionId = crypto.randomBytes(16).toString('hex');

  await sessionStore.put(sessionId, {
    id: samlReq.id,
    redirect_uri,
    response_type,
    state,
    code_challenge,
    code_challenge_method,
  });

  return redirect.success(res, samlConfig.idpMetadata.sso.redirectUrl, {
    RelayState: relayStatePrefix + sessionId,
    SAMLRequest: Buffer.from(samlReq.request).toString('base64'),
  });
};

const samlResponse = async (req, res) => {
  const { SAMLResponse } = req.body; // RelayState will contain the sessionId from earlier quasi-oauth flow

  let RelayState = req.body.RelayState || '';

  if (!options.idpEnabled && !RelayState.startsWith(relayStatePrefix)) {
    // IDP is disabled so block the request
    return res
      .status(403)
      .send(
        'IdP (Identity Provider) flow has been disabled. Please head to your Service Provider to login.'
      );
  }

  if (!RelayState.startsWith(relayStatePrefix)) {
    RelayState = '';
  }

  RelayState = RelayState.replace(relayStatePrefix, '');

  const rawResponse = Buffer.from(SAMLResponse, 'base64').toString();

  const parsedResp = await saml.parseAsync(rawResponse);

  const samlConfigs = await configStore.getByIndex({
    name: indexNames.entityID,
    value: parsedResp.issuer,
  });

  if (!samlConfigs || samlConfigs.length === 0) {
    return res.status(403).send('SAML configuration not found.');
  }

  // TODO: Support multiple matches
  const samlConfig = samlConfigs[0];

  let session;

  if (RelayState !== '') {
    session = await sessionStore.get(RelayState);
    if (!session) {
      return redirect.error(
        res,
        samlConfig.defaultRedirectUrl,
        'Unable to validate state from the origin request.'
      );
    }
  }

  let validateOpts = {
    thumbprint: samlConfig.idpMetadata.thumbprint,
    audience: options.samlAudience,
  };

  if (session && session.id) {
    validateOpts.inResponseTo = session.id;
  }

  const profile = await saml.validateAsync(rawResponse, validateOpts);
  
  // some providers don't return the id in the assertion, we set it to a sha256 hash of the email
  if (profile && profile.claims && !profile.claims['user.id']) {
    profile.claims['user.id'] = crypto.createHash('sha256').update(profile.claims['user.email']).digest('hex');
  }

  // store details against a code
  const code = crypto.randomBytes(20).toString('hex');

  let codeVal = {
    profile,
    clientID: samlConfig.clientID,
    clientSecret: samlConfig.clientSecret,
  };

  if (session) {
    codeVal.session = session;
  }

  await codeStore.put(code, codeVal);

  if (
    session &&
    session.redirect_uri &&
    !allowed.redirect(session.redirect_uri, samlConfig.redirectUrl)
  ) {
    return res.status(403).send('Redirect URL is not allowed.');
  }

  let params = {
    code,
  };

  if (session && session.state) {
    params.state = session.state;
  }

  return redirect.success(
    res,
    (session && session.redirect_uri) || samlConfig.defaultRedirectUrl,
    params
  );
};

const token = async (req, res) => {
  const {
    client_id,
    client_secret,
    code_verifier,
    code,
    grant_type = 'authorization_code',
  } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).send('Unsupported grant_type');
  }

  if (!code) {
    return res.status(400).send('Please specify code');
  }

  const codeVal = await codeStore.get(code);
  if (!codeVal || !codeVal.profile) {
    return res.status(403).send('Invalid code');
  }

  if (client_id && client_secret) {
    // check if we have an encoded client_id
    const sp = getEncodedClientId(client_id);
    if (!sp) {
      // OAuth flow
      if (
        client_id !== codeVal.clientID ||
        client_secret !== codeVal.clientSecret
      ) {
        return res.status(401).send('Invalid client_id or client_secret');
      }
    }
  } else if (code_verifier) {
    // PKCE flow
    let cv = code_verifier;
    if (codeVal.session.code_challenge_method.toLowerCase() === 's256') {
      cv = codeVerifier.encode(code_verifier);
    }

    if (codeVal.session.code_challenge !== cv) {
      return res.status(401).send('Invalid code_verifier');
    }
  } else if (codeVal && codeVal.session) {
    return res
      .status(401)
      .send('Please specify client_secret or code_verifier');
  }

  // store details against a token
  const token = crypto.randomBytes(20).toString('hex');

  await tokenStore.put(token, codeVal.profile);

  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: options.db.ttl,
  });
};

const userInfo = async (req, res) => {
  let token = extractAuthToken(req);

  // check for query param
  if (!token) {
    token = req.query.access_token;
  }

  const profile = await tokenStore.get(token);

  res.json(profile.claims);
};

module.exports = (opts) => {
  configStore = opts.configStore;
  sessionStore = opts.sessionStore;
  codeStore = opts.codeStore;
  tokenStore = opts.tokenStore;
  options = opts.opts;

  return {
    authorize,
    samlResponse,
    token,
    userInfo,
  };
};
