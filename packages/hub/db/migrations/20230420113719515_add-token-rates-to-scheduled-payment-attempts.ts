import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payment_attempts';
const FIELD = 'token_to_usdc_rate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(TABLE, {
    [FIELD]: { type: 'numeric' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, FIELD);
}
