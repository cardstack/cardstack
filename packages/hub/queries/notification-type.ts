import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { NotificationType } from '../routes/notification-preferences';

export default class NotificationTypeQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async query(): Promise<NotificationType[]> {
    let db = await this.databaseManager.getClient();

    let query = `SELECT id, notification_type, default_status FROM notification_types`;

    const queryResult = await db.query(query);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        notificationType: row['notification_type'],
        defaultStatus: row['default_status'],
      };
    });
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'notification-type': NotificationTypeQueries;
  }
}
