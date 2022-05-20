import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { EmailCardDropRequest } from '../routes/email-card-drop-requests';
import { buildConditions } from '../utils/queries';
import config from 'config';

interface EmailCardDropRequestsQueriesFilter {
  id?: string;
  claimedAt?: Date | Symbol;
  emailHash?: string;
  ownerAddress?: string;
  verificationCode?: string;
}

const emailVerificationLinkExpiryMinutes = config.get('cardDrop.email.expiryMinutes');

const IS_OLD = `requested_at <= now() - interval '${emailVerificationLinkExpiryMinutes} minutes'`;
const IS_EXPIRED = `${IS_OLD} AND claimed_at IS NULL`;
const RETURN_VALUE = `*, (${IS_EXPIRED}) as is_expired`;

export default class EmailCardDropRequestsQueries {
  clock = inject('clock');
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: EmailCardDropRequest): Promise<EmailCardDropRequest & { isExpired: boolean }> {
    let db = await this.databaseManager.getClient();

    let { rows } = await db.query(
      `INSERT INTO email_card_drop_requests (id, owner_address, email_hash, verification_code, requested_at, claimed_at, transaction_hash) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING ${RETURN_VALUE}`,
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

  async query(filter: EmailCardDropRequestsQueriesFilter): Promise<(EmailCardDropRequest & { isExpired: boolean })[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT ${RETURN_VALUE} FROM email_card_drop_requests WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map(mapRowToObject);
  }

  async latestRequest(ownerAddress: string) {
    let db = await this.databaseManager.getClient();
    const query = `
      SELECT ${RETURN_VALUE}
      FROM  email_card_drop_requests AS t1
      WHERE owner_address=$1 AND requested_at=(SELECT MAX(requested_at) FROM email_card_drop_requests WHERE t1.owner_address=email_card_drop_requests.owner_address)
    `;

    const queryResult = await db.query(query, [ownerAddress]);

    return queryResult.rows.map(mapRowToObject)[0];
  }

  // TODO does this cover everything? 🤔
  async activeReservations() {
    let db = await this.databaseManager.getClient();
    const query = `
      SELECT COUNT(*)
      FROM  email_card_drop_requests AS t1
      WHERE requested_at=(SELECT MAX(requested_at) FROM email_card_drop_requests WHERE t1.owner_address=email_card_drop_requests.owner_address)
    `;

    const queryResult = await db.query(query);
    return queryResult.rows[0].count;
  }

  async claimedInLastMinutes(minutes: number): Promise<(EmailCardDropRequest & { isExpired: boolean })[]> {
    let db = await this.databaseManager.getClient();

    let { rows } = await db.query(
      `
        SELECT COUNT(*) FROM email_card_drop_requests
        WHERE claimed_at > NOW() - interval '${minutes} minutes'
      `
    );

    return rows[0].count;
  }

  async claim(id: string): Promise<void> {
    let db = await this.databaseManager.getClient();

    await db.query(
      `
        UPDATE email_card_drop_requests
        SET claimed_at = $1
        WHERE id=$2
      `,
      [new Date(this.clock.now()), id]
    );

    return;
  }

  async updateTransactionHash(
    id: string,
    transactionHash: string
  ): Promise<(EmailCardDropRequest & { isExpired: boolean }) | null> {
    let db = await this.databaseManager.getClient();

    let { rows } = await db.query(
      `UPDATE email_card_drop_requests SET
        transaction_hash = $2
      WHERE ID = $1
      RETURNING ${RETURN_VALUE}`,
      [id, transactionHash]
    );

    return rows[0] ? mapRowToObject(rows[0]) : null;
  }
}

function mapRowToObject(row: any) {
  return {
    id: row['id'],
    ownerAddress: row['owner_address'],
    emailHash: row['email_hash'],
    verificationCode: row['verification_code'],
    claimedAt: row['claimed_at'],
    requestedAt: row['requested_at'],
    transactionHash: row['transaction_hash'],
    isExpired: row['is_expired'] as boolean,
  };
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'email-card-drop-requests': EmailCardDropRequestsQueries;
  }
}
