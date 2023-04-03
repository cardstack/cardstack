import { MigrationBuilder } from 'node-pg-migrate';

const PROOFS_TABLE = 'reward_proofs';
const ROOT_HASH_COLUMN_NAME = 'root_hash';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PROOFS_TABLE, {
    [ROOT_HASH_COLUMN_NAME]: { type: 'string', notNull: true },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PROOFS_TABLE, [ROOT_HASH_COLUMN_NAME]);
}
