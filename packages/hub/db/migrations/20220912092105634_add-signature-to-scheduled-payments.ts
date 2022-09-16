import { MigrationBuilder } from 'node-pg-migrate';
const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    signature: { type: 'text' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, 'signature');
}
