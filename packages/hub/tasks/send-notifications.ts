import { inject } from '@cardstack/di';
import { Helpers } from 'graphile-worker';
import * as Sentry from '@sentry/node';

export interface PushNotificationData {
  /**
   * A unique ID determined by the caller of this task, to be used for deduplication
   */
  notificationId: string;
  sendBy?: number;
  notificationType: string;
  pushClientId: string;
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

  async perform(payload: PushNotificationData, helpers: Helpers) {
    let messageId: string;
    try {
      let notificationHasBeenSent = await this.sentPushNotificationsQueries.exists({
        notificationId: payload.notificationId,
      });
      if (notificationHasBeenSent) {
        helpers.logger.info(`Not sending notification for ${payload.notificationId} because it has already been sent`);
        return;
      }

      if (payload.sendBy && payload.sendBy < Date.now()) {
        helpers.logger.info(
          `Notification ${payload.notificationId} failed to send because it was too old, should send by: ${new Date(
            payload.sendBy
          ).toString()}`
        );
        Sentry.captureException(new Error('Notification is too old to send'), {
          tags: {
            action: 'send-notifications',
            notificationId: payload.notificationId,
            notificationType: payload.notificationType,
          },
        });

        return;
      }

      messageId = await this.firebasePushNotifications.send({
        notification: {
          title: payload.notificationTitle,
          body: payload.notificationBody,
        },
        data: payload.notificationData,
        token: payload.pushClientId,
      });
      helpers.logger.info(`Sent notification for ${payload.notificationId}`);
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'send-notifications',
          notificationId: payload.notificationId,
          notificationType: payload.notificationType,
        },
      });
      // this error must be rethrown to make sure this task fails and is retried
      throw e;
    }

    try {
      // We don't want to have this in the same try catch block because
      // We don't want failure to write to the database to result in infinite notifications being sent
      await this.sentPushNotificationsQueries.insert({ ...payload, messageId });
    } catch (e) {
      // This error is important to catch and have an alert for. This means that our deduplication mechanism is failing
      Sentry.captureException(e, {
        tags: {
          action: 'send-notifications-deduplication',
          notificationId: payload.notificationId,
          notificationType: payload.notificationType,
          messageId,
        },
      });
      helpers.logger.error(`failed to record that notification with id ${payload.notificationId} is sent`);
    }
  }
}
