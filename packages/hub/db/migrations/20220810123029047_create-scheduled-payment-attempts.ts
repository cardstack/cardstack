import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payment_attempts';
const STATUS_ENUM = `${TABLE}_status_enum`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(STATUS_ENUM, ['in_progress', 'succeeded', 'failed']);

  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true },
    started_at: { type: 'timestamp' },
    ended_at: { type: 'timestamp' },
    status: { type: STATUS_ENUM, notNull: true, default: 'in_progress' },
    transaction_hash: { type: 'string' },
    failure_reason: { type: 'string' },
    scheduled_payment_id: { type: 'uuid', notNull: true, references: 'scheduled_payments' },
  });

  pgm.createIndex(TABLE, ['scheduled_payment_id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
  pgm.dropType(STATUS_ENUM);
}
