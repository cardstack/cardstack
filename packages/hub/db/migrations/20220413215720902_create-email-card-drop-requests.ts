import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const EMAIL_CARD_DROP_REQUESTS_TABLE = 'email_card_drop_requests';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(EMAIL_CARD_DROP_REQUESTS_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    owner_address: { type: 'string', notNull: true },
    email_hash: { type: 'string', notNull: true },
    verification_code: { type: 'string', notNull: true },
    requested_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    claimed_at: { type: 'timestamp', notNull: false },
    transaction_hash: { type: 'string', notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(EMAIL_CARD_DROP_REQUESTS_TABLE);
}
