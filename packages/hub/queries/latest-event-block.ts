import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';

const LATEST_EVENT_BLOCK_TABLE = 'latest_event_block';

export default class LatestEventBlockQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async read(): Promise<number | undefined> {
    let db = await this.databaseManager.getClient();

    let queryResult = await db.query(`SELECT block_number from ${LATEST_EVENT_BLOCK_TABLE} WHERE id = 1`);

    if (queryResult.rowCount) {
      let row = queryResult.rows[0];
      return row['block_number'];
    } else {
      return undefined;
    }
  }

  async update(blockNumber: number) {
    let db = await this.databaseManager.getClient();

    // Insert if empty, update but only if the block number is higher
    await db.query(
      `
      INSERT INTO ${LATEST_EVENT_BLOCK_TABLE} (id, block_number)
      VALUES ($1, $2)

      ON CONFLICT (id)
      DO UPDATE SET
        block_number = GREATEST(
          $2,
          (SELECT block_number FROM ${LATEST_EVENT_BLOCK_TABLE} WHERE id = 1)
        ),
        updated_at = NOW()
      `,
      [1, blockNumber]
    );
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'latest-event-block': LatestEventBlockQueries;
  }
}
