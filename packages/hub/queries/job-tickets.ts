import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { JobTicket } from '../routes/job-tickets';
import { buildConditions } from '../utils/queries';

export interface JobTicketsQueriesFilter {
  id?: string;
  jobType?: string;
  ownerAddress?: string;
  sourceArguments?: string;
}

export default class JobTicketsQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async find(filter: JobTicketsQueriesFilter): Promise<JobTicket | null> {
    let db = await this.databaseManager.getClient();

    let conditions = buildConditions(filter);
    let query = `SELECT * FROM job_tickets WHERE ${conditions.where}`;
    let queryResult = await db.query(query, conditions.values);

    if (queryResult.rows.length) {
      let row = queryResult.rows[0];

      return mapRowToModel(row);
    } else {
      return null;
    }
  }

  async insert(model: Partial<JobTicket>) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO job_tickets (id, job_type, owner_address, payload, spec, source_arguments) VALUES($1, $2, $3, $4, $5, $6)',
      [model.id, model.jobType, model.ownerAddress, model.payload, model.spec, model.sourceArguments]
    );

    return this.find({ id: model.id! });
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
