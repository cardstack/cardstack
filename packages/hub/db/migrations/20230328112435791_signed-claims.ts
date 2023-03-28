import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'signed_claims';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', notNull: true, primaryKey: true },
    claim_id: { type: 'uuid', notNull: true },
    signature: { type: 'text', notNull: true },
    encoded: { type: 'text', notNull: true },
    validator: { type: 'text', notNull: true },
  });
  pgm.createIndex(TABLE, ['claim_id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
}
