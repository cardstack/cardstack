import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { EmailCardDropRequest } from '../routes/email-card-drop-requests';
import { buildConditions } from '../utils/queries';

interface EmailCardDropRequestsQueriesFilter {
  id?: string;
  claimedAt?: Date | Symbol;
  emailHash?: string;
  ownerAddress?: string;
  verificationCode?: string;
}

export default class EmailCardDropRequestsQueries {
  clock = inject('clock');
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: EmailCardDropRequest): Promise<EmailCardDropRequest> {
    let db = await this.databaseManager.getClient();

    let { rows } = await db.query(
      'INSERT INTO email_card_drop_requests (id, owner_address, email_hash, verification_code, requested_at, claimed_at, transaction_hash) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        model.id,
        model.ownerAddress,
        model.emailHash,
        model.verificationCode,
        model.requestedAt,
        model.claimedAt,
        model.transactionHash,
      ]
    );

    return rows[0];
  }

  async query(filter: EmailCardDropRequestsQueriesFilter): Promise<EmailCardDropRequest[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT * FROM email_card_drop_requests WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        ownerAddress: row['owner_address'],
        emailHash: row['email_hash'],
        verificationCode: row['verification_code'],
        claimedAt: row['claimed_at'],
        requestedAt: row['requested_at'],
        transactionHash: row['transaction_hash'],
      };
    });
  }

  async claim({
    ownerAddress,
    verificationCode,
  }: {
    ownerAddress: string;
    verificationCode: string;
  }): Promise<EmailCardDropRequest> {
    let db = await this.databaseManager.getClient();

    let { rows } = await db.query(
      `
        UPDATE email_card_drop_requests
        SET claimed_at = $1
        WHERE owner_address = $2 AND verification_code = $3 AND claimed_at IS NULL
        RETURNING *
      `,
      [new Date(this.clock.now()), ownerAddress, verificationCode]
    );

    return rows[0];
  }

  async updateVerificationCode(id: string, verificationCode: string): Promise<EmailCardDropRequest> {
    let db = await this.databaseManager.getClient();

    let { rows } = await db.query(
      `UPDATE email_card_drop_requests SET
        verification_code = $2
      WHERE ID = $1
      RETURNING *`,
      [id, verificationCode]
    );

    return rows[0];
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'email-card-drop-requests': EmailCardDropRequestsQueries;
  }
}
