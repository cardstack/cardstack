import { inject } from '@cardstack/di';
import { Helpers } from 'graphile-worker';
import * as Sentry from '@sentry/node';

export interface PushNotificationData {
  /**
   * A unique ID determined by the caller of this task, to be used for deduplication
   */
  notificationId: string;
  notificationType: string;
  notificationToken: string;
  notificationTitle?: string;
  notificationBody?: string;
  notificationData?: {};
}

export interface PushNotificationsIdentifiers {
  notificationId: PushNotificationData['notificationId'];
}

export default class SendNotificationsTask {
  sentPushNotificationsQueries = inject('sent-push-notifications-queries', { as: 'sentPushNotificationsQueries' });
  firebasePushNotifications = inject('firebase-push-notifications', { as: 'firebasePushNotifications' });

  async perform<T extends PushNotificationData>(payload: T, helpers: Helpers) {
    try {
      let index = {
        notificationId: payload.notificationId,
      };

      let notificationHasBeenSent = await this.sentPushNotificationsQueries.exists(index);
      if (notificationHasBeenSent) {
        helpers.logger.info(`Not sending notification for ${payload.notificationId} because it has already been sent`);
        return;
      }

      let messageId = await this.firebasePushNotifications.send({
        notification: {
          title: payload.notificationTitle,
          body: payload.notificationBody,
        },
        data: payload.notificationData,
        token: payload.notificationToken,
      });
      helpers.logger.info(`Sent notification for ${payload.notificationId}`);
      await this.sentPushNotificationsQueries.insert({ ...payload, messageId });
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'send-notifications',
          notificationId: payload.notificationId,
          notificationType: payload.notificationType,
        },
      });
    }
  }
}
