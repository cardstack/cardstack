import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { buildConditions } from '../../utils/queries';

/**
 * This filter is the index of this table. All fields are necessary to identify a unique push notification for a given event
 */
interface SentPushNotificationsFilter {
  transactionHash: string;
  ownerAddress: string;
  pushClientId: string;
}

export interface PushNotificationData extends SentPushNotificationsFilter {
  notificationType: string;
  notificationTitle?: string;
  notificationBody: string;
  notificationData?: {};
}

export default class SentPushNotificationsQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: PushNotificationData) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO sent_push_notifications (transaction_hash, owner_address, push_client_id, notification_type, notification_title, notification_body, notification_data) VALUES($1, $2, $3, $4, $5, $6, $7)',
      [
        model.transactionHash,
        model.ownerAddress,
        model.pushClientId,
        model.notificationType,
        model.notificationTitle,
        model.notificationBody,
        model.notificationData,
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
