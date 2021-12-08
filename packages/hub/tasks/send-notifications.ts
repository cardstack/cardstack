import { inject } from '@cardstack/di';
import { Helpers } from 'graphile-worker';
import * as Sentry from '@sentry/node';

export interface PushNotificationData {
  transactionHash: string;
  ownerAddress: string;
  pushClientId: string;
  network: string;
  notificationType: string;
  notificationTitle?: string;
  notificationBody: string;
  notificationData?: {};
}

export interface PushNotificationsIdentifiers {
  transactionHash: PushNotificationData['transactionHash'];
  ownerAddress: PushNotificationData['ownerAddress'];
  pushClientId: PushNotificationData['pushClientId'];
}

export default class SendNotificationsTask {
  sentPushNotificationsQueries = inject('sent-push-notifications-queries', { as: 'sentPushNotificationsQueries' });
  firebasePushNotifications = inject('firebase-push-notifications', { as: 'firebasePushNotifications' });

  async perform(payload: PushNotificationData, helpers: Helpers) {
    try {
      let index = {
        transactionHash: payload.transactionHash,
        pushClientId: payload.pushClientId,
        ownerAddress: payload.ownerAddress,
      };

      let notificationHasBeenSent = await this.sentPushNotificationsQueries.exists(index);
      if (notificationHasBeenSent) {
        helpers.logger.info(`Not sending notification for ${payload.transactionHash} because it has already been sent`);
        return;
      }

      let messageId = await this.firebasePushNotifications.send({
        notification: {
          title: payload.notificationTitle,
          body: payload.notificationBody,
        },
        data: payload.notificationData,
        token: payload.pushClientId,
      });
      helpers.logger.info(`Sent notification for ${payload.transactionHash}`);
      await this.sentPushNotificationsQueries.insert({ ...payload, messageId });
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'send-notifications',
          transactionHash: payload.transactionHash,
        },
      });
    }
  }
}
