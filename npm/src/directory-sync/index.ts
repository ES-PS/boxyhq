import type { DatabaseStore, JacksonOption, IEventController } from '../typings';
import { DirectoryConfig } from './DirectoryConfig';
import { DirectoryUsers } from './DirectoryUsers';
import { DirectoryGroups } from './DirectoryGroups';
import { Users } from './Users';
import { Groups } from './Groups';
import { getDirectorySyncProviders } from './utils';
import { RequestHandler } from './request';
import { handleEventCallback } from './events';
import { WebhookEventsLogger } from './WebhookEventsLogger';

const directorySync = async (params: {
  db: DatabaseStore;
  opts: JacksonOption;
  eventController: IEventController;
}) => {
  const { db, opts, eventController } = params;

  const directories = new DirectoryConfig({ db, opts, eventController });
  const users = new Users({ db });
  const groups = new Groups({ db });

  const directoryUsers = new DirectoryUsers({ directories, users });
  const directoryGroups = new DirectoryGroups({ directories, users, groups });
  const webhookEventsLogger = new WebhookEventsLogger({ db });

  return {
    users,
    groups,
    directories,
    webhookLogs: webhookEventsLogger,
    requests: new RequestHandler(directoryUsers, directoryGroups),
    events: {
      callback: await handleEventCallback(directories, webhookEventsLogger),
    },
    providers: () => {
      return getDirectorySyncProviders();
    },
  };
};

export default directorySync;
