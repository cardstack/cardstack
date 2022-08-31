import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    canceled_at: { type: 'timestamp' },
  });

  pgm.renameColumn(TABLE, 'nonce', 'salt');

  pgm.createIndex(TABLE, ['canceled_at', 'pay_at', 'creation_block_number']);
  pgm.createIndex(TABLE, 'recurring_day_of_month');
  pgm.createIndex(TABLE, 'recurring_until');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(TABLE, ['canceled_at']);
  pgm.renameColumn(TABLE, 'salt', 'nonce');
}
