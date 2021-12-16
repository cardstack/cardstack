import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('cards', {
    compileErrors: { type: 'jsonb' },
    deps: { type: 'text[]' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('cards', 'compileErrors');
  pgm.dropColumn('cards', 'deps');
}
