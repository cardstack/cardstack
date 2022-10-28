import { MigrationBuilder } from 'node-pg-migrate';
import { uuid } from 'short-uuid';

const TABLE = 'account_nonces';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true, default: uuid() },
    account_address: { type: 'string', notNull: true },
    chain_id: { type: 'integer', notNull: true },
    nonce: { type: 'bigint', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex(TABLE, ['account_address', 'chain_id'], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
}
