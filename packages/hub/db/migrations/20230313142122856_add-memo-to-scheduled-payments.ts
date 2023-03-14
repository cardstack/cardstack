import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payments';
const PRIVATE_MEMO = 'private_memo';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(TABLE, { [PRIVATE_MEMO]: { type: 'string', notNull: false, default: undefined } });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, PRIVATE_MEMO);
}
