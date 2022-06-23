import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const JOB_TICKETS_TABLE = 'job_tickets';
export const JOB_TICKETS_STATE_DEFAULT = 'pending';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(JOB_TICKETS_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    job_type: { type: 'string', notNull: true },
    owner_address: { type: 'string', notNull: true },
    payload: { type: 'jsonb' },
    result: { type: 'jsonb' },
    state: { type: 'string', notNull: true, default: JOB_TICKETS_STATE_DEFAULT },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(JOB_TICKETS_TABLE, ['job_type', 'owner_address', 'state']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(JOB_TICKETS_TABLE);
}
