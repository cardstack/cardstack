import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    next_retry_attempt_at: { type: 'timestamp' },
    scheduled_payment_attempts_in_last_payment_cycle_count: { type: 'integer', default: 0, notNull: true },
    last_scheduled_payment_attempt_id: { type: 'uuid' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(TABLE, [
    'next_retry_attempt_at',
    'scheduled_payment_attempts_in_last_payment_cycle_count',
    'last_scheduled_payment_attempt_id',
  ]);
}
