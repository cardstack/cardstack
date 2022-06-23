import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const JOB_TICKETS_TABLE = 'job_tickets';
const SPEC_COLUMN_NAME = 'spec';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(JOB_TICKETS_TABLE, {
    [SPEC_COLUMN_NAME]: { type: 'jsonb' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(JOB_TICKETS_TABLE, [SPEC_COLUMN_NAME]);
}
