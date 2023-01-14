import type {
  Group,
  DirectorySyncResponse,
  Directory,
  DirectorySyncGroupMember,
  DirectorySyncRequest,
  ApiError,
  EventCallback,
  HTTPMethod,
  IDirectoryConfig,
  IUsers,
  IGroups,
} from '../typings';
import { parseGroupOperations, toGroupMembers } from './utils';
import { sendEvent } from './events';

export class DirectoryGroups {
  private directories: IDirectoryConfig;
  private users: IUsers;
  private groups: IGroups;
  private callback: EventCallback | undefined;

  constructor({
    directories,
    users,
    groups,
  }: {
    directories: IDirectoryConfig;
    users: IUsers;
    groups: IGroups;
  }) {
    this.directories = directories;
    this.users = users;
    this.groups = groups;
  }

  public async create(directory: Directory, body: any): Promise<DirectorySyncResponse> {
    const { displayName, members } = body;

    const { data: group } = await this.groups.create({
      directoryId: directory.id,
      name: displayName,
      raw: body,
    });

    // Add members to the group if any
    if (members && members.length > 0 && group) {
      await this.addOrRemoveGroupMembers(directory, group, members);
    }

    await sendEvent('group.created', { directory, group }, this.callback);

    return {
      status: 201,
      data: {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: group?.id,
        displayName: group?.name,
        members: members ?? [],
      },
    };
  }

  public async get(group: Group): Promise<DirectorySyncResponse> {
    return {
      status: 200,
      data: {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: group.id,
        displayName: group.name,
        members: toGroupMembers(await this.groups.getAllUsers(group.id)),
      },
    };
  }

  public async delete(directory: Directory, group: Group): Promise<DirectorySyncResponse> {
    await this.groups.removeAllUsers(group.id);
    await this.groups.delete(group.id);

    await sendEvent('group.deleted', { directory, group }, this.callback);

    return {
      status: 200,
      data: {},
    };
  }

  public async getAll(queryParams: { filter?: string; directoryId: string }): Promise<DirectorySyncResponse> {
    const { filter, directoryId } = queryParams;

    let groups: Group[] | null = [];

    if (filter) {
      // Filter by group displayName
      // filter: displayName eq "Developer"
      const { data } = await this.groups.search(filter.split('eq ')[1].replace(/['"]+/g, ''), directoryId);

      groups = data;
    } else {
      // Fetch all the existing group
      const { data } = await this.groups.getAll({ pageOffset: undefined, pageLimit: undefined });

      groups = data;
    }

    return {
      status: 200,
      data: {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: groups ? groups.length : 0,
        itemsPerPage: groups ? groups.length : 0,
        startIndex: 1,
        Resources: groups ? groups.map((group) => group.raw) : [],
      },
    };
  }

  // Update group displayName
  public async updateDisplayName(directory: Directory, group: Group, body: any): Promise<Group> {
    const { displayName } = body;

    const { data: updatedGroup, error } = await this.groups.update(group.id, {
      name: displayName,
      raw: {
        ...group.raw,
        ...body,
      },
    });

    if (error || !updatedGroup) {
      throw error;
    }

    await sendEvent('group.updated', { directory, group: updatedGroup }, this.callback);

    return updatedGroup;
  }

  public async patch(directory: Directory, group: Group, body: any): Promise<DirectorySyncResponse> {
    const { Operations } = body;

    const operation = parseGroupOperations(Operations);

    // Add group members
    if (operation.action === 'addGroupMember') {
      await this.addGroupMembers(directory, group, operation.members);
    }

    // Remove group members
    if (operation.action === 'removeGroupMember') {
      await this.removeGroupMembers(directory, group, operation.members);
    }

    // Update group name
    if (operation.action === 'updateGroupName') {
      await this.updateDisplayName(directory, group, {
        displayName: operation.displayName,
      });
    }

    const { data: updatedGroup } = await this.groups.get(group.id);

    return {
      status: 200,
      data: {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: updatedGroup?.id,
        displayName: updatedGroup?.name,
        members: toGroupMembers(await this.groups.getAllUsers(group.id)),
      },
    };
  }

  public async update(directory: Directory, group: Group, body: any): Promise<DirectorySyncResponse> {
    const { displayName, members } = body;

    // Update group name
    const updatedGroup = await this.updateDisplayName(directory, group, {
      displayName,
    });

    // Update group members
    if (members) {
      await this.addOrRemoveGroupMembers(directory, group, members);
    }

    return {
      status: 200,
      data: {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: group.id,
        displayName: updatedGroup.name,
        members: toGroupMembers(await this.groups.getAllUsers(group.id)),
      },
    };
  }

  public async addGroupMembers(
    directory: Directory,
    group: Group,
    members: DirectorySyncGroupMember[] | undefined,
    sendWebhookEvent = true
  ) {
    if (members === undefined || (members && members.length === 0)) {
      return;
    }

    for (const member of members) {
      if (await this.groups.isUserInGroup(group.id, member.value)) {
        continue;
      }

      await this.groups.addUserToGroup(group.id, member.value);

      const { data: user } = await this.users.get(member.value);

      if (sendWebhookEvent && user) {
        await sendEvent('group.user_added', { directory, group, user }, this.callback);
      }
    }
  }

  public async removeGroupMembers(
    directory: Directory,
    group: Group,
    members: DirectorySyncGroupMember[],
    sendWebhookEvent = true
  ) {
    if (members.length === 0) {
      return;
    }

    for (const member of members) {
      await this.groups.removeUserFromGroup(group.id, member.value);

      const { data: user } = await this.users.get(member.value);

      // User may not exist in the directory, so we need to check if the user exists
      if (sendWebhookEvent && user) {
        await sendEvent('group.user_removed', { directory, group, user }, this.callback);
      }
    }
  }

  // Add or remove users from a group
  public async addOrRemoveGroupMembers(
    directory: Directory,
    group: Group,
    members: DirectorySyncGroupMember[]
  ) {
    const users = toGroupMembers(await this.groups.getAllUsers(group.id));

    const usersToAdd = members.filter((member) => !users.some((user) => user.value === member.value));

    const usersToRemove = users
      .filter((user) => !members.some((member) => member.value === user.value))
      .map((user) => ({ value: user.value }));

    await this.addGroupMembers(directory, group, usersToAdd, false);
    await this.removeGroupMembers(directory, group, usersToRemove, false);
  }

  private respondWithError(error: ApiError | null) {
    return {
      status: error ? error.code : 500,
      data: null,
    };
  }

  // Handle the request from the Identity Provider and route it to the appropriate method
  public async handleRequest(
    request: DirectorySyncRequest,
    callback?: EventCallback
  ): Promise<DirectorySyncResponse> {
    const { body, query, resourceId: groupId, directoryId, apiSecret } = request;

    const method = request.method.toUpperCase() as HTTPMethod;

    // Get the directory
    const { data: directory, error } = await this.directories.get(directoryId);

    if (error || !directory) {
      return this.respondWithError(error);
    }

    // Validate the request
    if (directory.scim.secret != apiSecret) {
      return this.respondWithError({ code: 401, message: 'Unauthorized' });
    }

    this.callback = callback;

    this.users.setTenantAndProduct(directory.tenant, directory.product);
    this.groups.setTenantAndProduct(directory.tenant, directory.product);

    // Get the group
    const { data: group } = groupId ? await this.groups.get(groupId) : { data: null };

    if (groupId && !group) {
      return this.respondWithError({ code: 404, message: 'Group not found' });
    }

    if (group) {
      switch (method) {
        case 'GET':
          return await this.get(group);
        case 'PUT':
          return await this.update(directory, group, body);
        case 'PATCH':
          return await this.patch(directory, group, body);
        case 'DELETE':
          return await this.delete(directory, group);
      }
    }

    switch (method) {
      case 'POST':
        return await this.create(directory, body);
      case 'GET':
        return await this.getAll({
          filter: query.filter,
          directoryId,
        });
    }

    return {
      status: 404,
      data: {},
    };
  }
}
