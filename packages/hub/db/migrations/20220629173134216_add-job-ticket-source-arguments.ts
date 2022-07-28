import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const JOB_TICKETS_TABLE = 'job_tickets';
const SOURCE_ARGUMENTS_COLUMN_NAME = 'source_arguments';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(JOB_TICKETS_TABLE, {
    [SOURCE_ARGUMENTS_COLUMN_NAME]: { type: 'jsonb' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(JOB_TICKETS_TABLE, [SOURCE_ARGUMENTS_COLUMN_NAME]);
}
