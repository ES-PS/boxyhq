# SAML Jackson (not fiction anymore)

SAML service [SAML in a box from BoxyHQ]

You need someone like Jules Winnfield to save you from the vagaries of SAML login.

## Source code visualizer

[CodeSee codebase visualizer](https://app.codesee.io/maps/public/53e91640-23b5-11ec-a724-79d7dd589517)

## Getting Started

There are two ways to use this repo.

- As an npm library
- As a separate service

## Install as an npm library

Jackson is available as an [npm package](https://www.npmjs.com/package/@boxyhq/saml-jackson) that can be integrated into any web application framework (like Express.js for example). Please file an issue or submit a PR if you encounter any issues with your choice of framework.

```bash
npm i @boxyhq/saml-jackson
```

### Add Express Routes

```javascript
// express
const express = require('express');
const router = express.Router();
const cors = require('cors'); // needed if you are calling the token userinfo endpoints from the frontend

// Set the required options. Refer to https://github.com/boxyhq/jackson#configuration for the full list
const opts = {
  externalUrl: 'https://my-cool-app.com',
  samlAudience: 'https://my-cool-app.com',
  samlPath: '/sso/oauth/saml',
  db: {
    engine: 'mongo',
    url: 'mongodb://localhost:27017/my-cool-app',
  }
};


let apiController;
let oauthController;
// Please note that the initialization of @boxyhq/saml-jackson is async, you cannot run it at the top level
// Run this in a function where you initialise the express server.
async function init() {
  const ret = await require('@boxyhq/saml-jackson')(opts);
  apiController = ret.apiController;
  oauthController = ret.oauthController;
}

// express.js middlewares needed to parse json and x-www-form-urlencoded
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// SAML config API. You should pass this route through your authentication checks, do not expose this on the public interface without proper authentication in place.
router.post('/api/v1/saml/config', async (req, res) => {
  try {
    // apply your authentication flow (or ensure this route has passed through your auth middleware)
    ...

    // only when properly authenticated, call the config function
    res.json(await apiController.config(req.body));
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
// fetch config
router.get('/api/v1/saml/config', async (req, res) => {
  try {
    // apply your authentication flow (or ensure this route has passed through your auth middleware)
    ...

    // only when properly authenticated, call the config function
    res.json(await apiController.config(req.query));
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
// delete config
router.delete('/api/v1/saml/config', async (req, res) => {
  try {
    // apply your authentication flow (or ensure this route has passed through your auth middleware)
    ...

    // only when properly authenticated, call the config function
    await apiController.deleteConfig(req.body);
    res.status(200).end();
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});
// OAuth 2.0 flow
router.get('/oauth/authorize', async (req, res) => {
  try {
    const { redirect_url } = await oauthController.authorize(req.query);

    res.redirect(redirect_url);
  } catch (err) {
    const { message, statusCode = 500 } = err;

    res.status(statusCode).send(message);
  }
});

router.post('/oauth/saml', async (req, res) => {
  try {
    const { redirect_url } = await oauthController.samlResponse(req.body);

    res.redirect(redirect_url);
  } catch (err) {
    const { message, statusCode = 500 } = err;

    res.status(statusCode).send(message);
  }
});

router.post('/oauth/token', cors(), async (req, res) => {
  try {
    const result = await oauthController.token(req.body);

    res.json(result);
  } catch (err) {
    const { message, statusCode = 500 } = err;

    res.status(statusCode).send(message);
  }
});

router.get('/oauth/userinfo', async (req, res) => {
  try {
    let token = extractAuthToken(req);

    // check for query param
    if (!token) {
      token = req.query.access_token;
    }

    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
    }

    const profile = await oauthController.userInfo(token);

    res.json(profile);
  } catch (err) {
    const { message, statusCode = 500 } = err;

    res.status(statusCode).json({ message });
  }
});

// set the router
app.use('/sso', router);

```

## Deployment as a service: Docker

The docker container can be found at [boxyhq/jackson](https://hub.docker.com/r/boxyhq/jackson/tags). It is preferable to use a specific version instead of the `latest` tag. Jackson uses two ports (configurable if needed, see below) 5000 and 6000. 6000 is the internal port and ideally should not be exposed to a public network.

```bash
docker run -p 5000:5000 -p 6000:6000 boxyhq/jackson:78e9099d
```

Refer to <https://github.com/boxyhq/jackson#configuration> for the full configuration.

Kubernetes and docker-compose deployment files will be coming soon.

## Usage

### 1. Setting up SAML with your customer's Identity Provider

Please follow the instructions [here](https://docs.google.com/document/d/1fk---Z9Ln59u-2toGKUkyO3BF6Dh3dscT2u4J2xHANE) to guide your customers in setting up SAML correctly for your product(s). You should create a copy of the doc and modify it with your custom settings, we have used the values that work for our demo apps.

### 1.1 SAML profile/claims/attributes mapping

As outlined in the guide above we try and support 4 attributes in the SAML claims - `id`, `email`, `firstName`, `lastName`. This is how the common SAML attributes map over for most providers, but some providers have custom mappings. Please refer to the documentation on Identity Provider to understand the exact mapping.

| SAML Attribute                                                         | Jackson mapping |
| ---------------------------------------------------------------------- | --------------- |
| <http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier> | id              |
| <http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress>   | email           |
| <http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname>      | firstName       |
| <http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname>        | lastName        |

### 2. SAML config API

Once your customer has set up the SAML app on their Identity Provider, the Identity Provider will generate an IdP or SP metadata file. Some Identity Providers only generate an IdP metadata file but it usually works for the SP login flow as well. It is an XML file that contains various attributes Jackson needs to validate incoming SAML login requests. This step is the equivalent of setting an OAuth 2.0 app and generating a client ID and client secret that will be used in the login flow.

You will need to provide a place in the UI for your customers (The account settings page is usually a good place for this) to configure this and then call the API below.

The following API call sets up the configuration in Jackson:

```bash
curl --location --request POST 'http://localhost:6000/api/v1/saml/config' \
--header 'Authorization: Api-Key <Jackson API Key>' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'encodedRawMetadata=Base64(<IdP/SP metadata XML>)' \
--data-urlencode 'defaultRedirectUrl=http://localhost:3000/login/saml' \
--data-urlencode 'redirectUrl=["http://localhost:3000/*"]' \
--data-urlencode 'tenant=boxyhq.com' \
--data-urlencode 'product=demo'
```

- encodedRawMetadata: Base64 encoding of the XML metadata your customer gets from their Identity Provider
- defaultRedirectUrl: The redirect URL to use in the IdP login flow. Jackson will call this URL after completing an IdP login flow
- redirectUrl: JSON encoded array containing a list of allowed redirect URLs. Jackson will disallow any redirects not on this list (or not the default URL above)
- tenant: Jackson supports a multi-tenant architecture, this is a unique identifier you set from your side that relates back to your customer's tenant. This is normally an email, domain, an account id, or user-id
- product: Jackson support multiple products, this is a unique identifier you set from your side that relates back to the product your customer is using

The response returns a JSON with `client_id` and `client_secret` that can be stored against your tenant and product for a more secure OAuth 2.0 flow. If you do not want to store the `client_id` and `client_secret` you can alternatively use `client_id=tenant=<tenantID>&product=<productID>` and any arbitrary value for `client_secret` when setting up the OAuth 2.0 flow. Additionally a `provider` attribute is also returned which indicates the domain of your Identity Provider.

#### 2.1 SAML get config API

This endpoint can be used to return metadata about an existing SAML config. This can be used to check and display the details to your customers. You can use either `clientID` or `tenant` and `product` combination.

```bash
curl -G --location 'http://localhost:6000/api/v1/saml/config' \
--header 'Authorization: Api-Key <Jackson API Key>' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'tenant=boxyhq.com' \
--data-urlencode 'product=demo'
```

```bash
curl -G --location 'http://localhost:6000/api/v1/saml/config' \
--header 'Authorization: Api-Key <Jackson API Key>' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'clientID=<Client ID>'
```

The response returns a JSON with `provider` indicating the domain of your Identity Provider. If an empty JSON payload is returned then we do not have any configuration stored for the attributes you requested.

#### 2.2 SAML delete config API

This endpoint can be used to delete an existing IdP metadata.

```bash
curl -X "DELETE" --location 'http://localhost:6000/api/v1/saml/config' \
--header 'Authorization: Api-Key <Jackson API Key>' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'tenant=boxyhq.com' \
--data-urlencode 'product=demo'
```

```bash
curl -X "DELETE" --location 'http://localhost:6000/api/v1/saml/config' \
--header 'Authorization: Api-Key <Jackson API Key>' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'clientID=<Client ID>'
--data-urlencode 'clientSecret=<Client Secret>'
```

### 3. OAuth 2.0 Flow

Jackson has been designed to abstract the SAML login flow as a pure OAuth 2.0 flow. This means it's compatible with any standard OAuth 2.0 library out there, both client-side and server-side. It is important to remember that SAML is configured per customer unlike OAuth 2.0 where you can have a single OAuth app supporting logins for all customers.

Jackson also supports the PKCE authorization flow (<https://oauth.net/2/pkce/>), so you can protect your SPAs.

If for any reason you need to implement the flow on your own, the steps are outlined below:

### 4. Authorize

The OAuth flow begins with redirecting your user to the `authorize` URL:

```bash
https://localhost:5000/oauth/authorize
  ?response_type=code&provider=saml
  &client_id=<clientID or tenant and product query params as described in the SAML config API section above>
  &redirect_uri=<redirect URL>
  &state=<randomly generated state id>
```

- response_type=code: This is the only supported type for now but maybe extended in the future
- client_id: Use the client_id returned by the SAML config API or use `tenant=<tenantID>&product=<productID>` to use the tenant and product IDs instead. **Note:** Please don't forget to URL encode the query parameters including `client_id`.
- tenant: Optionally you can provide a dummy `client_id` and specify the `tenant` and `product` custom attributes (if your OAuth 2.0 library allows it).
- product: Should be specified if specifying `tenant` above
- redirect_uri: This is where the user will be taken back once the authorization flow is complete
- state: Use a randomly generated string as the state, this will be echoed back as a query parameter when taking the user back to the `redirect_uri` above. You should validate the state to prevent XSRF attacks

### 5. Code Exchange

After successful authorization, the user is redirected back to the `redirect_uri`. The query parameters will include the `code` and `state` parameters. You should validate that the state matches the one you sent in the `authorize` request.

The code can then be exchanged for a token by making the following request:

```bash
curl --request POST \
  --url 'http://localhost:5000/oauth/token' \
  --header 'content-type: application/x-www-form-urlencoded' \
  --data 'grant_type=authorization_code' \
  --data 'client_id=<clientID or tenant and product query params as described in the SAML config API section above>' \
  --data 'client_secret=<clientSecret or any arbitrary value if using the tenant and product in the clientID>' \
  --data 'redirect_uri=<redirect URL>' \
  --data 'code=<code from the query parameter above>'
```

- grant_type=authorization_code: This is the only supported flow, for now. We might extend this in the future
- client_id: Use the client_id returned by the SAML config API or use `tenant=<tenantID>&product=<productID>` to use the tenant and product IDs instead. **Note:** Please don't forget to URL encode the query parameters including `client_id`.
- client_secret: Use the client_secret returned by the SAML config API or any arbitrary value if using the tenant and product in the clientID
- redirect_uri: This is where the user will be taken back once the authorization flow is complete. Use the same redirect_uri as the previous request

If everything goes well you should receive a JSON response that includes the access token. This token is needed for the next step where we fetch the user profile.

```json
{
  "access_token": <access token>,
  "token_type": "bearer",
  "expires_in": 300
}
```

### 6. Profile Request

The short-lived access token can now be used to request the user's profile. You'll need to make the following request:

```bash
curl --request GET \
  --url https://localhost:5000/oauth/userinfo \
  --header 'authorization: Bearer <access token>' \
  --header 'content-type: application/json'
```

If everything goes well you should receive a JSON response with the user's profile:

```json
{
  "id": <id from the Identity Provider>,
  "email": "sjackson@coolstartup.com",
  "firstName": "SAML"
  "lastName": "Jackson"
}
```

- id: The id of the user as provided by the Identity Provider
- email: The email address of the user as provided by the Identity Provider
- firstName: The first name of the user as provided by the Identity Provider
- lastName: The last name of the user as provided by the Identity Provider

## Examples

To Do

## Database Support

Jackson currently supports the following databases.

- Postgres
- MySQL
- MariaDB
- MongoDB
- Redis

## Configuration

Configuration is done via env vars (and in the case of the npm library via an options object).

The following options are supported and will have to be configured during deployment.

| Key                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                          | Default                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| HOST_URL                                  | The URL to bind to                                                                                                                                                                                                                                                                                                                                                                                                   | `localhost`                     |
| HOST_PORT                                 | The port to bind to                                                                                                                                                                                                                                                                                                                                                                                                  | `5000`                          |
| EXTERNAL_URL (npm: externalUrl)           | The public URL to reach this service, used internally for documenting the SAML configuration instructions.                                                                                                                                                                                                                                                                                                           | `http://{HOST_URL}:{HOST_PORT}` |
| INTERNAL_HOST_URL                         | The URL to bind to expose the internal APIs. Do not configure this to a public network.                                                                                                                                                                                                                                                                                                                              | `localhost`                     |
| INTERNAL_HOST_PORT                        | The port to bind to for the internal APIs.                                                                                                                                                                                                                                                                                                                                                                           | `6000`                          |
| JACKSON_API_KEYS                          | A comma separated list of API keys that will be validated when serving the Config API requests                                                                                                                                                                                                                                                                                                                       |                                 |
| SAML_AUDIENCE (npm: samlAudience)         | This is just an identifier to validate the SAML audience, this value will also get configured in the SAML apps created by your customers. Once set do not change this value unless you get your customers to reconfigure their SAML again. It is case-sensitive. This does not have to be a real URL.                                                                                                                | `https://saml.boxyhq.com`       |
| IDP_ENABLED (npm: idpEnabled)             | Set to `true` to enable IdP initiated login for SAML. SP initiated login is the only recommended flow but you might have to support IdP login at times.                                                                                                                                                                                                                                                              | `false`                         |
| DB_ENGINE (npm: db.engine)                | Supported values are `redis`, `sql`, `mongo`, `mem`.                                                                                                                                                                                                                                                                                                                                                                 | `sql`                           |
| DB_URL (npm: db.url)                      | The database URL to connect to. For example `postgres://postgres:postgres@localhost:5450/jackson`                                                                                                                                                                                                                                                                                                                    |                                 |
| DB_TYPE (npm: db.type)                    | Only needed when DB_ENGINE is `sql`. Supported values are `postgres`, `mysql`, `mariadb`.                                                                                                                                                                                                                                                                                                                            | `postgres`                      |
| DB_TTL (npm: db.ttl)                      | TTL for the code, session and token stores (in seconds).                                                                                                                                                                                                                                                                                                                                                             | 300                             |
| DB_CLEANUP_LIMIT (npm: db.cleanupLimit)   | Limit cleanup of TTL entries to this number.                                                                                                                                                                                                                                                                                                                                                                         | 1000                            |
| DB_ENCRYPTION_KEY (npm: db.encryptionKey) | To encrypt data at rest specify a random 32 character string. You can use `openssl rand -base64 24` to generate one.                                                                                                                                                                                                                                                                                                 |                                 |
| PRE_LOADED_CONFIG                         | If you only need a single tenant or a handful of pre-configured tenants then this config will help you read and load SAML configs. It works well with the mem DB engine so you don't have to configure any external databases for this to work (though it works with those as well). This is a path (absolute or relative) to a directory that contains files organized in the format described in the next section. |                                 |

## Pre-loaded SAML Configuration

If PRE_LOADED_CONFIG is set then it should point to a directory with the following structure (example below):-

```bash
boxyhq.js
boxyhq.xml
anothertenant.js
anothertenant.xml
```

The JS file has the following structure:-

```javascript
module.exports = {
  defaultRedirectUrl: 'http://localhost:3000/login/saml',
  redirectUrl: '["http://localhost:3000/*", "http://localhost:5000/*"]',
  tenant: 'boxyhq.com',
  product: 'demo',
};
```

The XML file (should share the name with the .js file) is the raw XML metadata file you receive from your Identity Provider. Please ensure it is saved in the `utf-8` encoding.

The config and XML above correspond to the `SAML API config` (see below).

## SAML Login flows

There are two kinds of SAML login flows - SP-initiated and IdP-initiated. We highly recommend sticking to the SP-initiated flow since it is more secure but Jackson also supports the IdP-initiated flow if you enable it. For an in-depth understanding of SAML and the two flows please refer to Okta's comprehensive guide - <https://developer.okta.com/docs/concepts/saml/>.

## Contributing

Thanks for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make will benefit everybody else and are appreciated.

Please try to create bug reports that are:

- _Reproducible._ Include steps to reproduce the problem.
- _Specific._ Include as much detail as possible: which version, what environment, etc.
- _Unique._ Do not duplicate existing opened issues.
- _Scoped to a Single Bug._ One bug per report.

## Support

Reach out to the maintainer at one of the following places:

- [GitHub Discussions](https://github.com/boxyhq/jackson/discussions)
- [GitHub Issues](https://github.com/boxyhq/jackson/issues)
- The email which is located [in GitHub profile](https://github.com/deepakprabhakara)

## License

[Apache 2.0 License](https://github.com/boxyhq/jackson/blob/main/LICENSE)
