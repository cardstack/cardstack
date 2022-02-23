import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { Upload } from '../routes/upload';
import { buildConditions } from '../utils/queries';

interface UploadQueriesFilter {
  url: string;
}

export default class UploadQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: Upload) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO uploads (id, cid, service, url, filename, size, type, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
      [model.id, model.cid, model.service, model.url, model.filename, model.size, model.type, model.ownerAddress]
    );
  }

  async query(filter: UploadQueriesFilter): Promise<Upload[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT id, cid, service, url, filename, size, type, owner_address, owner_address FROM uploads WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        cid: row['cid'],
        url: row['url'],
        service: row['service'],
        filename: row['filename'],
        size: row['size'],
        type: row['type'],
        ownerAddress: row['owner_address'],
      };
    });
  }

  async isAbusing(ownerAddress: string): Promise<boolean> {
    let db = await this.databaseManager.getClient();

    const query = `SELECT COUNT(*) FROM uploads WHERE owner_address = $1 AND created_at > now() - INTERVAL '10 min'`;
    const queryResult = await db.query(query, [ownerAddress]);

    return queryResult.rows[0]['count'] >= 10;
  }
}
declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    upload: UploadQueries;
  }
}
