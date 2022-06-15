import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { JobTicket } from '../routes/job-tickets';

export default class JobTicketsQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async find(id: string): Promise<JobTicket | null> {
    let db = await this.databaseManager.getClient();

    let query = `SELECT * FROM job_tickets WHERE ID = $1`;
    let queryResult = await db.query(query, [id]);

    if (queryResult.rows.length) {
      let row = queryResult.rows[0];

      return {
        id: row['id'],
        jobType: row['job_type'],
        ownerAddress: row['owner_address'],
        state: row['state'],
        payload: row['payload'],
        result: row['result'],
      };
    } else {
      return null;
    }
  }

  async insert(model: Partial<JobTicket>) {
    let db = await this.databaseManager.getClient();

    await db.query('INSERT INTO job_tickets (id, job_type, owner_address) VALUES($1, $2, $3)', [
      model.id,
      model.jobType,
      model.ownerAddress,
    ]);
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'job-tickets': JobTicketsQueries;
  }
}
