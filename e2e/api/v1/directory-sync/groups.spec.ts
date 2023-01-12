import { test, expect } from '@playwright/test';
import { createDirectory, directoryPayload } from '../../helpers/directories';
import groups from '@boxyhq/saml-jackson/test/dsync/data/groups';
import { createGroup } from '../../helpers/groups';

test.use({
  extraHTTPHeaders: {
    Authorization: `Api-Key secret`,
    'Content-Type': 'application/json',
  },
});

const { tenant, product } = { ...directoryPayload, tenant: 'api-boxyhq-2' };

test.beforeAll(async ({ request }) => {
  const directory = await createDirectory(request, {
    ...directoryPayload,
    tenant,
  });

  await createGroup(request, directory, groups[0]);
  await createGroup(request, directory, groups[1]);
});

test.describe('GET /api/v1/directory-sync/groups', () => {
  test('should be able to get all groups from a directory', async ({ request }) => {
    const response = await request.get('/api/v1/directory-sync/groups', {
      params: {
        tenant,
        product,
      },
    });

    const { data: directoryGroups } = await response.json();
    const [firstGroup, secondGroup] = directoryGroups;

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
    expect(directoryGroups.length).toBe(2);

    expect(firstGroup).toMatchObject({
      id: expect.any(String),
      name: groups[1].displayName,
      raw: groups[1],
    });

    expect(secondGroup).toMatchObject({
      id: expect.any(String),
      name: groups[0].displayName,
      raw: groups[0],
    });
  });
});

test.describe('GET /api/v1/directory-sync/groups/:id', () => {
  test('should be able to get a group from a directory', async ({ request }) => {
    let response = await request.get('/api/v1/directory-sync/groups', {
      params: {
        tenant,
        product,
      },
    });

    const { data: directoryGroups } = await response.json();
    const [firstGroup] = directoryGroups;

    response = await request.get(`/api/v1/directory-sync/groups/${firstGroup.id}`, {
      params: {
        tenant,
        product,
      },
    });

    const { data: directoryGroup } = await response.json();

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
    expect(directoryGroup).toMatchObject(firstGroup);
  });
});
