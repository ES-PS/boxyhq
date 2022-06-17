import { DirectorySync, Directory } from '../../src/typings';
import tap from 'tap';
import users from './data/users';
import requests from './data/user-requests';
import { getFakeDirectory } from './data/directories';
import { getDatabaseOption } from '../utils';

let directorySync: DirectorySync;
let directory: Directory;
const fakeDirectory = getFakeDirectory();

tap.before(async () => {
  const jackson = await (await import('../../src/index')).default(getDatabaseOption());

  directorySync = jackson.directorySync;

  directory = await directorySync.directories.create(fakeDirectory);
});

tap.teardown(async () => {
  // Delete the directory after test
  await directorySync.directories.delete(directory.id);

  process.exit(0);
});

tap.test('Directory users / ', async (t) => {
  let createdUser: any;

  tap.beforeEach(async () => {
    // Create a user before each test
    const { data } = await directorySync.usersRequest.handle(requests.create(directory.id, users[0]));

    createdUser = data;
  });

  tap.afterEach(async () => {
    // Delete the user after each test
    await directorySync.users.delete(createdUser.id);
  });

  t.test('Should be able to get the user by userName', async (t) => {
    const { status, data } = await directorySync.usersRequest.handle(
      requests.filterByUsername(directory.id, createdUser.userName)
    );

    t.ok(data);
    t.equal(status, 200);
    t.hasStrict(data.Resources[0], createdUser);
    t.hasStrict(data.Resources[0], users[0]);

    t.end();
  });

  t.test('Should be able to get the user by id', async (t) => {
    const { status, data } = await directorySync.usersRequest.handle(
      requests.getById(directory.id, createdUser.id)
    );

    t.ok(data);
    t.equal(status, 200);
    t.hasStrict(data, users[0]);

    t.end();
  });

  t.test('Should be able to update the user using PUT request', async (t) => {
    const toUpdate = {
      ...users[0],
      name: {
        givenName: 'Jackson Updated',
        familyName: 'M',
      },
      city: 'New York',
    };

    const { status, data: updatedUser } = await directorySync.usersRequest.handle(
      requests.updateById(directory.id, createdUser.id, toUpdate)
    );

    t.ok(updatedUser);
    t.equal(status, 200);
    t.hasStrict(updatedUser, toUpdate);
    t.match(updatedUser.city, toUpdate.city);

    // Make sure the user was updated
    const { data: user } = await directorySync.usersRequest.handle(
      requests.getById(directory.id, createdUser.id)
    );

    t.ok(user);
    t.hasStrict(user, toUpdate);
    t.match(user.city, toUpdate.city);

    t.end();
  });

  t.test('Should be able to delete the user using PATCH request', async (t) => {
    const toUpdate = {
      ...users[0],
      active: false,
    };

    const { status, data } = await directorySync.usersRequest.handle(
      requests.updateOperationById(directory.id, createdUser.id)
    );

    t.ok(data);
    t.equal(status, 200);
    t.hasStrict(data, toUpdate);

    // Make sure the user was deleted
    const { data: user } = await directorySync.usersRequest.handle(
      requests.filterByUsername(directory.id, data.userName)
    );

    t.hasStrict(user.Resources, []);
    t.hasStrict(user.totalResults, 0);

    t.end();
  });

  t.test('Should delete the user if active:false', async (t) => {
    const toUpdate = {
      ...users[0],
      active: false,
    };

    const { status, data: updatedUser } = await directorySync.usersRequest.handle(
      requests.updateById(directory.id, createdUser.id, toUpdate)
    );

    t.ok(updatedUser);
    t.equal(status, 200);
    t.hasStrict(updatedUser, toUpdate);

    // Make sure the user was deleted
    const { data: user } = await directorySync.usersRequest.handle(
      requests.filterByUsername(directory.id, createdUser.userName)
    );

    t.hasStrict(user.Resources, []);
    t.hasStrict(user.totalResults, 0);

    t.end();
  });

  t.test('Should be able to fetch all users', async (t) => {
    const { status, data } = await directorySync.usersRequest.handle(requests.getAll(directory.id));

    t.ok(data);
    t.equal(status, 200);
    t.ok(data.Resources);
    t.equal(data.Resources.length, 1);
    t.hasStrict(data.Resources[0], users[0]);
    t.equal(data.totalResults, 1);

    t.end();
  });

  t.test('Should be able to delete the user', async (t) => {
    const { status, data } = await directorySync.usersRequest.handle(
      requests.deleteById(directory.id, createdUser.id)
    );

    t.equal(status, 200);
    t.ok(data);
    t.strictSame(data, createdUser);

    // Make sure the user was deleted
    const { data: user } = await directorySync.usersRequest.handle(
      requests.filterByUsername(directory.id, createdUser.userName)
    );

    t.hasStrict(user.Resources, []);
    t.hasStrict(user.totalResults, 0);

    t.end();
  });

  t.test('Should be able to delete all users using clear() method', async (t) => {
    directorySync.users.setTenantAndProduct(directory.tenant, directory.product);

    await directorySync.users.clear();

    // Make sure all the user was deleted
    const users = await directorySync.users.list({});

    t.equal(users.length, 0);

    t.end();
  });

  t.end();
});
