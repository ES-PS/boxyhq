import { test as baseTest, expect } from '@playwright/test';
import { DSyncPage } from 'e2e/support/fixtures';
import { getDirectory } from 'e2e/api/helpers/directories';
import { options } from 'e2e/api/helpers/api';
import {
  addGroupMember,
  createGroup,
  createUser,
  deleteGroup,
  deleteUser,
  updateGroupName,
  updateUser,
} from 'e2e/api/helpers';
import { azureGroup, azureGroupUpdatedName, azureUser, updatedAzureUser } from 'e2e/support/data/dsync';

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
  //  Send API requests to user/groups endpoint
  const [directory] = await getDirectory(request, { tenant: dsyncPage.tenant, product: dsyncPage.product });
  const azureUser1 = azureUser(1);
  const user1 = await createUser(request, directory, azureUser1);
  const group = await createGroup(request, directory, azureGroup);
  await addGroupMember(request, directory, group, user1.id);
  // Assert created user
  await dsyncPage.switchToDSyncInfoView();
  await dsyncPage.switchToUsersView({ waitForData: true });
  await expect(page.getByRole('cell', { name: azureUser1.name.givenName, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: azureUser1.name.familyName, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: azureUser1.emails[0].value, exact: true })).toBeVisible();
  // Assert created group
  await dsyncPage.switchToGroupsView({ waitForData: true });
  await expect(await page.getByRole('cell', { name: 'BoxyHQ' })).toBeVisible();
  // Enable webhook logs
  await dsyncPage.setWebHookEventsLogging({ enable: true });
  const azureUser2 = azureUser(2);
  const user2 = await createUser(request, directory, azureUser2);
  await addGroupMember(request, directory, group, user2.id);
  // Assert created user
  await dsyncPage.switchToDSyncInfoView();
  await dsyncPage.switchToUsersView({ waitForData: true });
  await expect(page.getByRole('cell', { name: azureUser2.name.givenName, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: azureUser2.name.familyName, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: azureUser2.emails[0].value, exact: true })).toBeVisible();
  // Patch second user
  const azureUser2Patch = updatedAzureUser(2);
  await updateUser(request, directory, user2.id, azureUser2Patch);
  await page.reload();
  // Assert updated attributes for user
  await expect(
    page.getByRole('cell', { name: azureUser2Patch.Operations[0].value, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: azureUser2Patch.Operations[1].value, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: azureUser2Patch.Operations[2].value, exact: true })
  ).toBeVisible();
  // Assert webhook logs
  await dsyncPage.switchToEventsView({ waitForData: true });
  await dsyncPage.inspectEventRow(0, directory.webhook.endpoint);
  await expect(page.getByText('"user.updated"')).toBeVisible();
  await dsyncPage.switchToEventsView({ waitForData: true });
  await dsyncPage.inspectEventRow(1, directory.webhook.endpoint);
  await expect(page.getByText('"group.user_added"')).toBeVisible();
  await dsyncPage.switchToEventsView({ waitForData: true });
  await dsyncPage.inspectEventRow(2, directory.webhook.endpoint);
  await expect(page.getByText('"user.created"')).toBeVisible();
  // Delete webhook logs
  await dsyncPage.switchToEventsView();
  await page.getByRole('button', { name: 'Remove Events' }).click();
  await page.getByTestId('confirm-delete').click();
  await page.getByRole('table').waitFor({ state: 'detached' });
  await expect(
    await page.getByRole('heading', { name: 'No webhook events found for this directory.' })
  ).toBeVisible();
  await dsyncPage.setWebHookEventsLogging({ enable: false });
  // User deletion
  await deleteUser(request, directory, user1.id);
  await deleteUser(request, directory, user2.id);
  await dsyncPage.switchToDSyncInfoView();
  await dsyncPage.switchToUsersView();
  await expect(page.getByRole('heading', { name: 'No users found for this directory.' })).toBeVisible();
  await updateGroupName(request, directory, group.id, azureGroupUpdatedName);
  await dsyncPage.switchToGroupsView({ waitForData: true });
  await expect(page.getByRole('cell', { name: azureGroupUpdatedName })).toBeVisible();
  // Group deletion
  await deleteGroup(request, directory, group.id);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No groups found for this directory.' })).toBeVisible();
  await dsyncPage.switchToEventsView();
  await expect(
    await page.getByRole('heading', { name: 'No webhook events found for this directory.' })
  ).toBeVisible();
});
