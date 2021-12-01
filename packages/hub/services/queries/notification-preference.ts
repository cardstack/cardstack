import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { NotificationPreference } from '../../routes/notification-preferences';
import { buildConditions } from '../../utils/queries';

export default class NotificationPreferenceQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async query(ownerAddress: string): Promise<NotificationPreference[]> {
    let db = await this.databaseManager.getClient();

    let conditions = buildConditions({ ownerAddress });

    let query = `SELECT notification_type, status, owner_address
      FROM notification_preferences
      INNER JOIN notification_types ON notification_types.id = notification_preferences.notification_type_id
      WHERE ${conditions.where}`;

    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        notificationType: row['notification_type'],
        ownerAddress: row['owner_address'],
        status: row['status'],
      };
    });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'notification-preference-queries': NotificationPreferenceQueries;
  }
}
