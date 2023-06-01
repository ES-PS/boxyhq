import _ from 'lodash';

import type {
  Directory,
  IDirectoryConfig,
  IGroups,
  Group,
  IRequestHandler,
  DirectorySyncRequest,
  EventCallback,
  IDirectoryProvider,
} from '../../typings';
import { compareAndFindDeletedGroups, isGroupUpdated, toGroupSCIMPayload } from './utils';

interface SyncGroupsParams {
  groups: IGroups;
  provider: IDirectoryProvider;
  directories: IDirectoryConfig;
  requestHandler: IRequestHandler;
  callback: EventCallback;
}

type HandleRequestParams = Pick<DirectorySyncRequest, 'method' | 'body' | 'resourceId'>;

export class SyncGroups {
  private groups: IGroups;
  private provider: IDirectoryProvider;
  private requestHandler: IRequestHandler;
  private callback: EventCallback;

  constructor({ groups, callback, requestHandler, provider }: SyncGroupsParams) {
    this.groups = groups;
    this.provider = provider;
    this.requestHandler = requestHandler;
    this.callback = callback;
  }

  async sync() {
    const directories = await this.provider.getDirectories();

    for (const directory of directories) {
      await this.syncGroup(directory);
    }
  }

  async syncGroup(directory: Directory) {
    this.groups.setTenantAndProduct(directory.tenant, directory.product);

    const groups = await this.provider.getGroups(directory);

    // Create or update groups
    for (const group of groups) {
      const { data: existingGroup } = await this.groups.get(group.id);

      if (!existingGroup) {
        await this.createGroup(directory, group);
      } else if (isGroupUpdated(existingGroup, group, this.provider.groupFieldsToExcludeWhenCompare)) {
        await this.updateGroup(directory, group);
      }
    }

    // Delete groups that are not in the directory anymore
    const { data: existingGroups } = await this.groups.getAll({ directoryId: directory.id });

    await this.deleteGroups(directory, compareAndFindDeletedGroups(existingGroups, groups));
  }

  async createGroup(directory: Directory, group: Group) {
    console.info('Creating group: ', _.pick(group, ['id', 'name']));

    await this.handleRequest(directory, {
      method: 'POST',
      body: toGroupSCIMPayload(group),
      resourceId: undefined,
    });
  }

  async updateGroup(directory: Directory, group: Group) {
    console.info('Updating group: ', _.pick(group, ['id', 'name']));

    await this.handleRequest(directory, {
      method: 'PUT',
      body: toGroupSCIMPayload(group),
      resourceId: group.id,
    });
  }

  async deleteGroups(directory: Directory, groups: Group[]) {
    for (const group of groups) {
      console.info('Deleting group: ', _.pick(group, ['id', 'name']));

      await this.handleRequest(directory, {
        method: 'DELETE',
        body: toGroupSCIMPayload(group),
        resourceId: group.id,
      });
    }
  }

  async handleRequest(directory: Directory, payload: HandleRequestParams) {
    const request: DirectorySyncRequest = {
      query: {},
      body: payload.body,
      resourceType: 'groups',
      method: payload.method,
      directoryId: directory.id,
      apiSecret: directory.scim.secret,
      resourceId: payload.resourceId,
    };

    await this.requestHandler.handle(request, this.callback);
  }
}
