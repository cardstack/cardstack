import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';

export default class JobTicketsQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async find(id: string) {
    let db = await this.databaseManager.getClient();

    let query = `SELECT * FROM job_tickets WHERE ID = $1`;
    let queryResult = await db.query(query, [id]);
    return queryResult.rows[0];
  }

  async insert(id: string, jobType: string, ownerAddress: string) {
    let db = await this.databaseManager.getClient();

    await db.query('INSERT INTO job_tickets (id, job_type, owner_address) VALUES($1, $2, $3)', [
      id,
      jobType,
      ownerAddress,
    ]);
  }

  async update(id: string, result: any, state: string) {
    let db = await this.databaseManager.getClient();

    await db.query(
      `UPDATE job_tickets SET
        result = $2,
        state = $3
      WHERE ID = $1`,
      [id, result, state]
    );
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'job-tickets': JobTicketsQueries;
  }
}
