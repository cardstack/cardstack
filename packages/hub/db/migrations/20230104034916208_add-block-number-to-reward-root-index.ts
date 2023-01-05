import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'reward_root_index';
const BLOCK_NUMBER_NAME = 'block_number';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    [BLOCK_NUMBER_NAME]: { type: 'integer', notNull: true },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(TABLE, [BLOCK_NUMBER_NAME]);
}
