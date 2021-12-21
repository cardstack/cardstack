import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { PushNotificationData, PushNotificationsIdentifiers } from '../../tasks/send-notifications';
import { buildConditions } from '../../utils/queries';

type SentPushNotificationsFilter = PushNotificationsIdentifiers;

export default class SentPushNotificationsQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  // messageId is firebase's message id
  // notificationId is our own identifier for the notification
  // pushClientId identifies the device
  async insert(model: PushNotificationData & { messageId: string }) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO sent_push_notifications (notification_id, push_client_id, notification_type, notification_title, notification_body, notification_data, message_id) VALUES($1, $2, $3, $4, $5, $6, $7)',
      [
        model.notificationId,
        model.pushClientId,
        model.notificationType,
        model.notificationTitle,
        model.notificationBody,
        model.notificationData,
        model.messageId,
      ]
    );
  }

  async exists(filter: SentPushNotificationsFilter): Promise<boolean> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT 1 FROM sent_push_notifications WHERE ${conditions.where} LIMIT 1`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rowCount > 0;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'sent-push-notifications-queries': SentPushNotificationsQueries;
  }
}
