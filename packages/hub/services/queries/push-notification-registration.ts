import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import type { PushNotificationRegistration } from '../../routes/push-notification-registrations';
import { buildConditions } from '../../utils/queries';

interface PushNotificationRegistrationQueriesFilter {
  ownerAddress: string;
  pushClientId?: string;
  disabledAt?: string | null;
}

export default class PushNotificationRegistrationQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async query(filter: PushNotificationRegistrationQueriesFilter): Promise<PushNotificationRegistration[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT id, owner_address, push_client_id, disabled_at FROM push_notification_registrations WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        ownerAddress: row['owner_address'],
        pushClientId: row['push_client_id'],
        disabledAt: row['disabled_at'],
      };
    });
  }

  async insert(model: PushNotificationRegistration) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO push_notification_registrations (id, owner_address, push_client_id, disabled_at) VALUES($1, $2, $3, $4)',
      [model.id, model.ownerAddress, model.pushClientId, model.disabledAt]
    );
  }

  async update(model: PushNotificationRegistration) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'UPDATE push_notification_registrations SET disabled_at = $1 WHERE owner_address = $2 AND push_client_id = $3',
      [model.disabledAt, model.ownerAddress, model.pushClientId]
    );
  }

  async delete(model: PushNotificationRegistration) {
    let db = await this.databaseManager.getClient();

    await db.query('DELETE FROM push_notification_registrations WHERE owner_address = $1 AND push_client_id = $2', [
      model.ownerAddress,
      model.pushClientId,
    ]);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'push-notification-registration-queries': PushNotificationRegistrationQueries;
  }
}
