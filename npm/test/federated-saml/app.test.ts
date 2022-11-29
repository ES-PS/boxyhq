import tap from 'tap';

import { SAMLFederation } from '../../src';
import { databaseOptions } from '../utils';
import { tenant, product, serviceProvider, appId } from './constants';

let samlFederatedController: SAMLFederation;

tap.before(async () => {
  const jackson = await (await import('../../src/index')).default(databaseOptions);

  samlFederatedController = jackson.samlFederatedController;
});

tap.test('Federated SAML App', async (t) => {
  const app = await samlFederatedController.app.create({
    name: 'Test App',
    tenant,
    product,
    entityId: serviceProvider.entityId,
    acsUrl: serviceProvider.acsUrl,
  });

  tap.test('Should be able to create a new SAML Federation app', async (t) => {
    t.ok(app);
    t.match(app.id, appId);
    t.match(app.tenant, tenant);
    t.match(app.product, product);
    t.match(app.entityId, serviceProvider.entityId);
    t.match(app.acsUrl, serviceProvider.acsUrl);

    t.end();
  });

  tap.test('Should be able to get the SAML Federation app by id', async (t) => {
    const response = await samlFederatedController.app.get(app.id);

    t.ok(response);
    t.match(response.id, app.id);

    t.end();
  });

  tap.test('Should be able to get the SAML Federation app by entity id', async (t) => {
    const response = await samlFederatedController.app.getByEntityId(serviceProvider.entityId);

    t.ok(response);
    t.match(response.entityId, serviceProvider.entityId);

    t.end();
  });

  tap.test('Should be able to update the SAML Federation app', async (t) => {
    const response = await samlFederatedController.app.update(app.id, {
      name: 'Updated App Name',
      acsUrl: 'https://twilio.com/saml/acsUrl/updated',
    });

    t.ok(response);
    t.match(response.name, 'Updated App Name');
    t.match(response.acsUrl, 'https://twilio.com/saml/acsUrl/updated');

    const updatedApp = await samlFederatedController.app.get(app.id);

    t.ok(updatedApp);
    t.match(updatedApp.name, 'Updated App Name');
    t.match(updatedApp.acsUrl, 'https://twilio.com/saml/acsUrl/updated');

    t.end();
  });

  tap.test('Should be able to get all SAML Federation apps', async (t) => {
    const response = await samlFederatedController.app.getAll();

    t.ok(response);
    t.ok(response.length === 1);

    t.end();
  });

  tap.test('Should be able to delete the SAML Federation app', async (t) => {
    await samlFederatedController.app.delete(app.id);

    const allApps = await samlFederatedController.app.getAll();

    t.ok(allApps.length === 0);

    t.end();
  });

  t.end();
});

tap.teardown(async () => {
  process.exit(0);
});
