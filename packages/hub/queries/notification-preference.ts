import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { NotificationPreference } from '../routes/notification-preferences';
import { buildConditions } from '../utils/queries';
import pgFormat from 'pg-format';

interface NotificationPreferenceQueriesFilter {
  ownerAddress: string;
  pushClientId?: string;
  notificationType?: string;
}

export default class NotificationPreferenceQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async query(filter: NotificationPreferenceQueriesFilter): Promise<NotificationPreference[]> {
    let db = await this.databaseManager.getClient();

    let conditions = buildConditions(filter);

    let query = `SELECT owner_address, push_client_id, notification_type, status
      FROM notification_preferences
      INNER JOIN notification_types ON notification_types.id = notification_preferences.notification_type_id
      WHERE ${conditions.where}`;

    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        ownerAddress: row['owner_address'],
        pushClientId: row['push_client_id'],
        notificationType: row['notification_type'],
        status: row['status'],
      };
    });
  }

  async upsert(model: NotificationPreference) {
    let db = await this.databaseManager.getClient();

    let query = `INSERT INTO notification_preferences(
      owner_address, push_client_id, notification_type_id, status
    )
    VALUES (%L) ON CONFLICT (owner_address, push_client_id, notification_type_id) DO UPDATE SET
    status = excluded.status;`;

    let notificationTypeId = await this.notificationTypeToId(model.notificationType);
    let sql = pgFormat(query, [model.ownerAddress, model.pushClientId, notificationTypeId, model.status]);

    await db.query(sql);
  }

  private async notificationTypeToId(notificationType: string) {
    let db = await this.databaseManager.getClient();

    let query = `SELECT id FROM notification_types WHERE notification_type = $1`;

    const queryResult = await db.query(query, [notificationType]);

    return queryResult.rows[0].id;
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'notification-preference': NotificationPreferenceQueries;
  }
}
