import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';

const EMAIL_CARD_DROP_STATE_TABLE = 'email_card_drop_state';

export default class EmailCardDropStateQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async read(): Promise<boolean> {
    let db = await this.databaseManager.getClient();

    let queryResult = await db.query(`SELECT rate_limited from ${EMAIL_CARD_DROP_STATE_TABLE} WHERE id = 1`);

    if (queryResult.rowCount) {
      let row = queryResult.rows[0];
      return row['rate_limited'];
    } else {
      return false;
    }
  }

  async update(rateLimited: boolean) {
    let db = await this.databaseManager.getClient();

    // Insert if empty, update but only if the block number is higher
    await db.query(
      `
      INSERT INTO ${EMAIL_CARD_DROP_STATE_TABLE} (id, rate_limited)
      VALUES ($1, $2)

      ON CONFLICT (id)
      DO UPDATE SET
        rate_limited = GREATEST(
          $2,
          (SELECT rate_limited FROM ${EMAIL_CARD_DROP_STATE_TABLE} WHERE id = 1)
        ),
        updated_at = NOW()
      `,
      [1, rateLimited]
    );
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'email-card-drop-state': EmailCardDropStateQueries;
  }
}
