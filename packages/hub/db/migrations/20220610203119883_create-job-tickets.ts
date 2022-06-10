import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const JOB_TICKETS_TABLE = 'job_tickets';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(JOB_TICKETS_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    job_type: { type: 'string', notNull: true },
    owner_address: { type: 'string', notNull: true },
    payload: { type: 'jsonb' },
    result: { type: 'jsonb' },
    state: { type: 'string', notNull: true, default: 'pending' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(JOB_TICKETS_TABLE);
}
