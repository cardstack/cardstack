import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'crank_nonces';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chain_id: { type: 'integer', notNull: true, unique: true },
    nonce: { type: 'bigint', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
}
