import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    canceled_at: { type: 'timestamp' },
  });
  pgm.createIndex(TABLE, 'canceled_at');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(TABLE, ['canceled_at']);
}
