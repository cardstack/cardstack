import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payment_attempts';
const EXECUTION_GAS_PRICE = 'execution_gas_price';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(TABLE, {
    [EXECUTION_GAS_PRICE]: { type: 'string', notNull: true, default: '0' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, EXECUTION_GAS_PRICE);
}
