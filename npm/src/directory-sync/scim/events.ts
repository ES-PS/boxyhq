import type {
  DirectorySyncEventType,
  Directory,
  User,
  Group,
  EventCallback,
  DirectorySyncEvent,
  IWebhookEventsLogger,
  IDirectoryConfig,
  IDirectoryEvents,
  JacksonOption,
} from '../../typings';
import { sendPayloadToWebhook } from '../../event/webhook';
import { transformEventPayload } from './transform';
import { isConnectionActive } from '../../controller/utils';

interface Payload {
  directory: Directory;
  group?: Group | null;
  user?: User | null;
}

interface EventCallbackParams {
  opts: JacksonOption;
  directories: IDirectoryConfig;
  directoryEvents: IDirectoryEvents;
  webhookEventsLogger: IWebhookEventsLogger;
}

export const sendEvent = async (
  event: DirectorySyncEventType,
  payload: Payload,
  callback?: EventCallback
) => {
  if (!isConnectionActive(payload.directory)) {
    return;
  }

  if (!callback) {
    return;
  }

  await callback(transformEventPayload(event, payload));
};

export const handleEventCallback = async ({
  opts,
  directories,
  directoryEvents,
  webhookEventsLogger,
}: EventCallbackParams) => {
  // Callback that handles the events for Jackson service
  return async (event: DirectorySyncEvent) => {
    const { tenant, product, directory_id: directoryId } = event;

    const { data: directory } = await directories.get(directoryId);

    if (!directory) {
      return;
    }

    if (!directory.webhook.endpoint || !directory.webhook.secret) {
      return;
    }

    // If bulk sync is enabled, push the event to the queue
    // We will process the queue later in the background
    if (opts.dsync && opts.dsync.bulkSyncLimit > 1) {
      await directoryEvents.push(event);
      return;
    }

    // Send the event to the webhook (synchronously)

    let status = 200;

    try {
      await sendPayloadToWebhook(directory.webhook, event);
    } catch (err: any) {
      status = err.response ? err.response.status : 500;
    }

    if (directory.log_webhook_events) {
      await webhookEventsLogger.setTenantAndProduct(tenant, product).log(directory, event, status);
    }
  };
};
