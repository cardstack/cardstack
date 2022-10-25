import { MigrationBuilder } from 'node-pg-migrate';
const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    gas_token_address: { type: 'text', notNull: true },
  });

  pgm.alterColumn(TABLE, 'creation_block_number', { type: 'integer', notNull: false });
  pgm.alterColumn(TABLE, 'cancelation_block_number', { type: 'integer', notNull: false });
  pgm.alterColumn(TABLE, 'amount', { type: 'string', notNull: true });
  pgm.alterColumn(TABLE, 'max_gas_price', { type: 'string', notNull: true });
  pgm.alterColumn(TABLE, 'execution_gas_estimation', { type: 'integer', notNull: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, 'gas_token_address');

  pgm.alterColumn(TABLE, 'creation_block_number', { type: 'bigint' });
  pgm.alterColumn(TABLE, 'cancelation_block_number', { type: 'bigint' });
  pgm.alterColumn(TABLE, 'amount', { type: 'string', notNull: true });
  pgm.alterColumn(TABLE, 'max_gas_price', { type: 'bigint', notNull: true });
  pgm.alterColumn(TABLE, 'execution_gas_estimation', { type: 'bigint', notNull: true });
}
