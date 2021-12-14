import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('cards', {
    compileErrors: { type: 'jsonb' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('cards', 'compileErrors');
}
