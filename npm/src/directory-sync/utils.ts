import type {
  Directory,
  DirectorySyncEvent,
  DirectorySyncEventType,
  DirectorySyncGroupMember,
  Group,
  User,
} from '../typings';
import { DirectorySyncProviders, UserPatchOperation } from '../typings';
import { transformUser, transformGroup, transformUserGroup } from './transform';
import crypto from 'crypto';

const parseGroupOperations = (
  operations: {
    op: 'add' | 'remove' | 'replace';
    path: string;
    value: any;
  }[]
):
  | {
      action: 'addGroupMember' | 'removeGroupMember';
      members: DirectorySyncGroupMember[];
    }
  | {
      action: 'updateGroupName';
      displayName: string;
    }
  | {
      action: 'unknown';
    } => {
  const { op, path, value } = operations[0];

  // Add group members
  if (op === 'add' && path === 'members') {
    return {
      action: 'addGroupMember',
      members: value,
    };
  }

  // Remove group members
  if (op === 'remove' && path === 'members') {
    return {
      action: 'removeGroupMember',
      members: value,
    };
  }

  // Remove group members
  if (op === 'remove' && path.startsWith('members[value eq')) {
    return {
      action: 'removeGroupMember',
      members: [{ value: path.split('"')[1] }],
    };
  }

  // Update group name
  if (op === 'replace') {
    return {
      action: 'updateGroupName',
      displayName: value.displayName,
    };
  }

  return {
    action: 'unknown',
  };
};

const toGroupMembers = (users: { user_id: string }[]): DirectorySyncGroupMember[] => {
  return users.map((user) => ({
    value: user.user_id,
  }));
};

// List of directory sync providers
// TODO: Fix the return type
const getDirectorySyncProviders = (): { [K: string]: string } => {
  return Object.entries(DirectorySyncProviders).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const transformEventPayload = (
  event: DirectorySyncEventType,
  payload: { directory: Directory; group?: Group | null; user?: User | null }
): DirectorySyncEvent => {
  const { directory, group, user } = payload;
  const { tenant, product, id: directory_id } = directory;

  const eventPayload = {
    event,
    tenant,
    product,
    directory_id,
  } as DirectorySyncEvent;

  // User events
  if (['user.created', 'user.updated', 'user.deleted'].includes(event) && user) {
    eventPayload['data'] = transformUser(user);
  }

  // Group events
  if (['group.created', 'group.updated', 'group.deleted'].includes(event) && group) {
    eventPayload['data'] = transformGroup(group);
  }

  // Group membership events
  if (['group.user_added', 'group.user_removed'].includes(event) && user && group) {
    eventPayload['data'] = transformUserGroup(user, group);
  }

  return eventPayload;
};

// Create request headers
const createHeader = async (secret: string, event: DirectorySyncEvent) => {
  return {
    'Content-Type': 'application/json',
    'BoxyHQ-Signature': await createSignatureString(secret, event),
  };
};

// Create a signature string
const createSignatureString = async (secret: string, event: DirectorySyncEvent) => {
  if (!secret) {
    return '';
  }

  const timestamp = new Date().getTime();

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(event)}`)
    .digest('hex');

  return `t=${timestamp},s=${signature}`;
};

// Parse the PATCH request body and return the user attributes (both standard and custom)
const parseUserPatchRequest = (operation: UserPatchOperation) => {
  const { value, path } = operation;

  const attributes: Partial<User> = {};
  const rawAttributes = {};

  const attributesMap = {
    active: 'active',
    'name.givenName': 'first_name',
    'name.familyName': 'last_name',
  };

  // If there is a path, then the value is the value
  // For example { path: "active", value: true }
  if (path) {
    if (path in attributesMap) {
      attributes[attributesMap[path]] = value;
    }

    rawAttributes[path] = value;
  }

  // If there is no path, then the value can be an object with multiple attributes
  // For example { value: { active: true, "name.familyName": "John" } }
  else if (typeof value === 'object') {
    for (const attribute of Object.keys(value)) {
      if (attribute in attributesMap) {
        attributes[attributesMap[attribute]] = value[attribute];
      }

      rawAttributes[attribute] = value[attribute];
    }
  }

  return {
    attributes,
    rawAttributes,
  };
};

// function dotToObject(data) {
//   function index(parent, key, value) {
//     const [mainKey, ...children] = key.split('.');
//     parent[mainKey] = parent[mainKey] || {};

//     if (children.length === 1) {
//       parent[mainKey][children[0]] = value;
//     } else {
//       index(parent[mainKey], children.join('.'), value);
//     }
//   }

//   const result = Object.entries(data).reduce((acc, [key, value]) => {
//     if (key.includes('.')) {
//       index(acc, key, value);
//     } else {
//       acc[key] = value;
//     }

//     return acc;
//   }, {});
//   return result;
// }

export {
  parseGroupOperations,
  toGroupMembers,
  getDirectorySyncProviders,
  transformEventPayload,
  createHeader,
  createSignatureString,
  parseUserPatchRequest,
};
