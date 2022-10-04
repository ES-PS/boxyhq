import sinon from 'sinon';
import tap from 'tap';
import * as dbutils from '../../src/db/utils';
import controllers from '../../src/index';
import { IConnectionAPIController, OIDCSSOConnection } from '../../src/typings';
import { oidc_connection } from './fixture';
import { databaseOptions } from '../utils';

let connectionAPIController: IConnectionAPIController;

const CLIENT_ID_OIDC = '85edb050796a0eb1cf2cfb0da7245f85bc50baa7';
const PROVIDER = 'accounts.google.com';

tap.before(async () => {
  const controller = await controllers(databaseOptions);

  connectionAPIController = controller.connectionAPIController;
});

tap.teardown(async () => {
  process.exit(0);
});

tap.test('controller/api', async (t) => {
  t.afterEach(async () => {
    await connectionAPIController.deleteConnections({
      tenant: oidc_connection.tenant,
      product: oidc_connection.product,
    });
  });

  t.test('Create the connection', async (t) => {
    t.test('when required fields are missing or invalid', async (t) => {
      t.test('missing discoveryUrl', async (t) => {
        const body: OIDCSSOConnection = Object.assign({}, oidc_connection);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete body['oidcDiscoveryUrl'];
        try {
          await connectionAPIController.createOIDCConnection(body);
          t.fail('Expecting JacksonError.');
        } catch (err: any) {
          t.equal(err.message, 'Please provide the discoveryUrl for the OpenID Provider');
          t.equal(err.statusCode, 400);
        }
      });
      t.test('missing clientId', async (t) => {
        const body: OIDCSSOConnection = Object.assign({}, oidc_connection);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete body['oidcClientId'];
        try {
          await connectionAPIController.createOIDCConnection(body);
          t.fail('Expecting JacksonError.');
        } catch (err: any) {
          t.equal(err.message, 'Please provide the clientId from OpenID Provider');
          t.equal(err.statusCode, 400);
        }
      });
      t.test('missing clientSecret', async (t) => {
        const body: OIDCSSOConnection = Object.assign({}, oidc_connection);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete body['oidcClientSecret'];
        try {
          await connectionAPIController.createOIDCConnection(body);
          t.fail('Expecting JacksonError.');
        } catch (err: any) {
          t.equal(err.message, 'Please provide the clientSecret from OpenID Provider');
          t.equal(err.statusCode, 400);
        }
      });

      t.test('when `defaultRedirectUrl` is empty', async (t) => {
        const body: Partial<OIDCSSOConnection> = Object.assign({}, oidc_connection);
        delete body['defaultRedirectUrl'];

        try {
          await connectionAPIController.createOIDCConnection(body as OIDCSSOConnection);
          t.fail('Expecting JacksonError.');
        } catch (err: any) {
          t.equal(err.message, 'Please provide a defaultRedirectUrl');
          t.equal(err.statusCode, 400);
        }
      });

      t.test('when `redirectUrl` is empty', async (t) => {
        const body: Partial<OIDCSSOConnection> = Object.assign({}, oidc_connection);
        delete body['redirectUrl'];

        try {
          await connectionAPIController.createOIDCConnection(body as OIDCSSOConnection);
          t.fail('Expecting JacksonError.');
        } catch (err: any) {
          t.equal(err.message, 'Please provide redirectUrl');
          t.equal(err.statusCode, 400);
        }
      });

      t.test('when defaultRedirectUrl or redirectUrl is invalid', async (t) => {
        const body_oidc_provider: OIDCSSOConnection = Object.assign({}, oidc_connection);

        t.test('when defaultRedirectUrl is invalid', async (t) => {
          body_oidc_provider['defaultRedirectUrl'] = 'http://localhost::';
          try {
            await connectionAPIController.createOIDCConnection(body_oidc_provider as OIDCSSOConnection);
            t.fail('Expecting JacksonError.');
          } catch (err: any) {
            t.equal(err.message, 'defaultRedirectUrl is invalid');
            t.equal(err.statusCode, 400);
          }
        });

        t.test('when redirectUrl list is huge', async (t) => {
          body_oidc_provider['redirectUrl'] = Array(101).fill('http://localhost:8080');
          try {
            await connectionAPIController.createOIDCConnection(body_oidc_provider as OIDCSSOConnection);
            t.fail('Expecting JacksonError.');
          } catch (err: any) {
            t.equal(err.message, 'Exceeded maximum number of allowed redirect urls');
            t.equal(err.statusCode, 400);
          }
        });

        t.test('when redirectUrl list contains invalid', async (t) => {
          body_oidc_provider['redirectUrl'] = '["http://localhost:8000","http://localhost::8080"]';

          try {
            await connectionAPIController.createOIDCConnection(body_oidc_provider as OIDCSSOConnection);
            t.fail('Expecting JacksonError.');
          } catch (err: any) {
            t.equal(err.message, 'redirectUrl is invalid');
            t.equal(err.statusCode, 400);
          }
        });
      });

      t.test('tenant/product empty', async (t) => {
        t.test('when `tenant` is empty', async (t) => {
          const body: Partial<OIDCSSOConnection> = Object.assign({}, oidc_connection);
          delete body['tenant'];

          try {
            await connectionAPIController.createOIDCConnection(body as OIDCSSOConnection);
            t.fail('Expecting JacksonError.');
          } catch (err: any) {
            t.equal(err.message, 'Please provide tenant');
            t.equal(err.statusCode, 400);
          }
        });

        t.test('when `product` is empty', async (t) => {
          const body: Partial<OIDCSSOConnection> = Object.assign({}, oidc_connection);
          delete body['product'];

          try {
            await connectionAPIController.createOIDCConnection(body as OIDCSSOConnection);
            t.fail('Expecting JacksonError.');
          } catch (err: any) {
            t.equal(err.message, 'Please provide product');
            t.equal(err.statusCode, 400);
          }
        });
      });
    });

    t.test('when the request is good', async (t) => {
      const body = Object.assign({}, oidc_connection);

      const kdStub = sinon.stub(dbutils, 'keyDigest').returns(CLIENT_ID_OIDC);

      const response = await connectionAPIController.createOIDCConnection(body);

      t.ok(kdStub.called);
      t.equal(response.clientID, CLIENT_ID_OIDC);
      t.equal(response.oidcProvider.provider, PROVIDER);

      const savedConnection = (
        await connectionAPIController.getConnections({
          clientID: CLIENT_ID_OIDC,
        })
      )[0];

      t.equal(savedConnection.name, oidc_connection.name);
      t.equal(savedConnection.oidcProvider.clientId, oidc_connection.oidcClientId);
      t.equal(savedConnection.oidcProvider.clientSecret, oidc_connection.oidcClientSecret);

      kdStub.restore();
    });
  });

  t.test('Update the connection', async (t) => {
    const body_oidc_provider: OIDCSSOConnection = Object.assign({}, oidc_connection);
    t.test('When clientID is missing', async (t) => {
      const { clientSecret } = await connectionAPIController.createOIDCConnection(
        body_oidc_provider as OIDCSSOConnection
      );
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await connectionAPIController.updateOIDCConnection({
          description: 'A new description',
          clientID: '',
          clientSecret,
          defaultRedirectUrl: oidc_connection.defaultRedirectUrl,
          redirectUrl: oidc_connection.redirectUrl,
          tenant: oidc_connection.tenant,
          product: oidc_connection.product,
        });
        t.fail('Expecting JacksonError.');
      } catch (err: any) {
        t.equal(err.message, 'Please provide clientID');
        t.equal(err.statusCode, 400);
        t.end();
      }
    });

    t.test('When clientSecret is missing', async (t) => {
      const { clientID } = await connectionAPIController.createOIDCConnection(
        body_oidc_provider as OIDCSSOConnection
      );
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await connectionAPIController.updateOIDCConnection({
          description: 'A new description',
          clientID,
          clientSecret: '',
          defaultRedirectUrl: oidc_connection.defaultRedirectUrl,
          redirectUrl: oidc_connection.redirectUrl,
          tenant: oidc_connection.tenant,
          product: oidc_connection.product,
        });
        t.fail('Expecting JacksonError.');
      } catch (err: any) {
        t.equal(err.message, 'Please provide clientSecret');
        t.equal(err.statusCode, 400);
        t.end();
      }
    });

    t.test('Update the name/description', async (t) => {
      const { clientID, clientSecret } = await connectionAPIController.createOIDCConnection(
        body_oidc_provider as OIDCSSOConnection
      );
      const { name, description } = (await connectionAPIController.getConnections({ clientID }))[0];
      t.equal(name, 'OIDC Metadata for oidc.example.com');
      t.equal(description, 'OIDC Metadata for oidc.example.com');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await connectionAPIController.updateOIDCConnection({
        clientID,
        clientSecret,
        redirectUrl: oidc_connection.redirectUrl,
        defaultRedirectUrl: oidc_connection.defaultRedirectUrl,
        name: 'A new name',
        description: 'A new description',
        tenant: oidc_connection.tenant,
        product: oidc_connection.product,
      });
      const savedConnection = (await connectionAPIController.getConnections({ clientID }))[0];
      t.equal(savedConnection.name, 'A new name');
      t.equal(savedConnection.description, 'A new description');
    });
  });

  t.test('Get the connection', async (t) => {
    t.test('when valid request', async (t) => {
      const body: OIDCSSOConnection = Object.assign({}, oidc_connection);

      await connectionAPIController.createOIDCConnection(body as OIDCSSOConnection);

      const savedConnection = (await connectionAPIController.getConnections(body))[0];

      t.equal(savedConnection.name, 'OIDC Metadata for oidc.example.com');
    });

    t.test('when invalid request', async (t) => {
      let response;

      const body: OIDCSSOConnection = Object.assign({}, oidc_connection);

      await connectionAPIController.createOIDCConnection(body);

      // Empty body
      try {
        await connectionAPIController.getConnections({ clientID: '' });
        t.fail('Expecting Error.');
      } catch (err: any) {
        t.match(err.message, 'Please provide `clientID` or `tenant` and `product`.');
      }

      // Invalid clientID
      response = await connectionAPIController.getConnections({
        clientID: 'an invalid clientID',
      });

      t.match(response, {});

      // Invalid tenant and product combination
      response = await connectionAPIController.getConnections({
        tenant: 'demo.com',
        product: 'desk',
      });

      t.match(response, []);
    });
  });

  t.test('Delete the connection', async (t) => {
    t.test('when valid request', async (t) => {
      const body: OIDCSSOConnection = Object.assign({}, oidc_connection);

      const { clientID, clientSecret } = await connectionAPIController.createOIDCConnection(body);

      await connectionAPIController.deleteConnections({
        clientID,
        clientSecret,
      });

      const response = await connectionAPIController.getConnections({
        clientID,
      });

      t.match(response, []);
    });

    t.test('when invalid request', async (t) => {
      const body: OIDCSSOConnection = Object.assign({}, oidc_connection);

      const { clientID } = await connectionAPIController.createOIDCConnection(body);

      // Empty body
      try {
        await connectionAPIController.deleteConnections({ clientID: '', clientSecret: '' });
        t.fail('Expecting Error.');
      } catch (err: any) {
        t.match(err.message, 'Please provide `clientID` and `clientSecret` or `tenant` and `product`.');
      }

      // Invalid clientID or clientSecret
      try {
        await connectionAPIController.deleteConnections({
          clientID,
          clientSecret: 'invalid client secret',
        });

        t.fail('Expecting Error.');
      } catch (err: any) {
        t.match(err.message, 'clientSecret mismatch');
      }
    });
  });
});
