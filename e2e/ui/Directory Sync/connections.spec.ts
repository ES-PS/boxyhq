import { test as baseTest, expect } from '@playwright/test';
import { DSyncPage } from 'e2e/support/fixtures';
import { getDirectory } from 'e2e/api/helpers/directories';
import { options } from 'e2e/api/helpers/api';
import { addGroupMember, createGroup, createUser } from 'e2e/api/helpers';
import { azureGroup, azureUser } from 'e2e/support/data/dsync';

type MyFixtures = {
  dsyncPage: DSyncPage;
};

export const test = baseTest.extend<MyFixtures>({
  dsyncPage: async ({ page }, use) => {
    const dsyncPage = new DSyncPage(page);
    await use(dsyncPage);
    await dsyncPage.deleteConnection();
  },
});

test.use(options);

test('Azure SCIM connection', async ({ dsyncPage, request, page }) => {
  await dsyncPage.addDSyncConnection('azure-scim-v2');
  await dsyncPage.gotoDSync();
  //  Send API requests to user/groups endpoint
  const [directory] = await getDirectory(request, { tenant: dsyncPage.tenant, product: dsyncPage.product });
  const azureUser1 = azureUser(1);
  const user1 = await createUser(request, directory, azureUser1);
  const group = await createGroup(request, directory, azureGroup);
  await addGroupMember(request, directory, group, user1.id);
  // Assert created user
  await dsyncPage.switchToUsersView();
  expect(await page.getByRole('cell', { name: azureUser1.name.givenName, exact: true })).toBeVisible();
  expect(await page.getByRole('cell', { name: azureUser1.name.familyName, exact: true })).toBeVisible();
  expect(await page.getByRole('cell', { name: azureUser1.emails[0].value, exact: true })).toBeVisible();
  // Assert created group
  await dsyncPage.switchToGroupsView();
  expect(await page.getByRole('cell', { name: 'BoxyHQ' })).toBeVisible();
  // Enable webhook logs
  await dsyncPage.enableWebHookEventLogging();
  const azureUser2 = azureUser(2);
  const user2 = await createUser(request, directory, azureUser2);
  await addGroupMember(request, directory, group, user2.id);
  // Assert created user
  await dsyncPage.switchToUsersView();
  expect(await page.getByRole('cell', { name: azureUser2.name.givenName, exact: true })).toBeVisible();
  expect(await page.getByRole('cell', { name: azureUser2.name.familyName, exact: true })).toBeVisible();
  expect(await page.getByRole('cell', { name: azureUser2.emails[0].value, exact: true })).toBeVisible();
  // Assert webhook logs
  await dsyncPage.switchToEventsView();
  await dsyncPage.inspectEventRow(0, directory.webhook.endpoint);
  expect(await page.getByText('"group.user_added"')).toBeVisible();
  await dsyncPage.switchToEventsView();
  await dsyncPage.inspectEventRow(1, directory.webhook.endpoint);
  expect(await page.getByText('"user.created"')).toBeVisible();
  // Delete webhook logs
  await dsyncPage.switchToEventsView();
  await page.getByRole('button', { name: 'Remove Events' }).click();
  await page.getByTestId('confirm-delete').click();
  await page.getByRole('table').waitFor({ state: 'detached' });
  expect(
    await page.getByRole('heading', { name: 'No webhook events found for this directory.' })
  ).toBeVisible();
});
