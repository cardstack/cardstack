import { MigrationBuilder } from 'node-pg-migrate';
const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    user_address: { type: 'text', notNull: true },
    creation_transaction_error: { type: 'text' },
    cancellation_transaction_error: { type: 'text' },
  });

  pgm.createIndex(TABLE, 'user_address');

  pgm.alterColumn(TABLE, 'fee_fixed_usd', { type: 'numeric', notNull: true });
  pgm.alterColumn(TABLE, 'fee_percentage', { type: 'numeric', notNull: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, 'user_address');
  pgm.dropColumn(TABLE, 'creation_transaction_error');
  pgm.dropColumn(TABLE, 'cancellation_transaction_error');

  pgm.alterColumn(TABLE, 'fee_fixed_usd', { type: 'integer', notNull: true });
  pgm.alterColumn(TABLE, 'fee_percentage', { type: 'integer', notNull: true });
}
