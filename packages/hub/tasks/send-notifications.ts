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
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  firebasePushNotifications = inject('firebase-push-notifications', { as: 'firebasePushNotifications' });

  async perform(payload: PushNotificationData, helpers: Helpers) {
    let messageId: string;
    let prisma = await this.prismaManager.getClient();
    try {
      let notificationHasBeenSent = await prisma.sentPushNotification.findFirst({
        where: {
          notificationId: payload.notificationId,
        },
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
    } catch (e: any) {
      if (e.errorInfo?.code === 'messaging/registration-token-not-registered') {
        await prisma.pushNotificationRegistration.updateMany({
          where: { pushClientId: payload.pushClientId },
          data: { disabledAt: new Date() },
        });

        helpers.logger.info(
          `Disabled push notification registration for ${payload.pushClientId} because Firebase rejected notification ${payload.notificationId}`
        );

        return;
      }

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
      await prisma.sentPushNotification.create({ data: { ...payload, messageId } });
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

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'send-notifications': SendNotificationsTask;
  }
}
