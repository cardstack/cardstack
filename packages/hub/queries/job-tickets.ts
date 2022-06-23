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

      return mapRowToModel(row);
    } else {
      return null;
    }
  }

  async findAll(): Promise<JobTicket[]> {
    let db = await this.databaseManager.getClient();

    let query = `SELECT * FROM job_tickets`;
    let queryResult = await db.query(query);

    return queryResult.rows.map((row) => mapRowToModel(row));
  }

  async insert(model: Partial<JobTicket>) {
    let db = await this.databaseManager.getClient();

    await db.query('INSERT INTO job_tickets (id, job_type, owner_address, payload, spec) VALUES($1, $2, $3, $4, $5)', [
      model.id,
      model.jobType,
      model.ownerAddress,
      model.payload,
      model.spec,
    ]);

    return this.find(model.id!);
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

function mapRowToModel(row: any): JobTicket {
  return {
    id: row['id'],
    jobType: row['job_type'],
    ownerAddress: row['owner_address'],
    spec: row['spec'],
    state: row['state'],
    payload: row['payload'],
    result: row['result'],
  };
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'job-tickets': JobTicketsQueries;
  }
}
