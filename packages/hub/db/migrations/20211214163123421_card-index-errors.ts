import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // this is because we're repurposing "data" column
  pgm.sql('DELETE FROM cards');

  pgm.addColumn('cards', {
    compileErrors: { type: 'jsonb' },
    deps: { type: 'text[]' },
    raw: { type: 'jsonb' },
    compiled: { type: 'jsonb' },
  });

  pgm.createTable('realm_metas', {
    realm: { type: 'text', primaryKey: true },
    meta: { type: 'jsonb' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('cards', 'compileErrors');
  pgm.dropColumn('cards', 'deps');
  pgm.dropColumn('cards', 'raw');
  pgm.dropColumn('cards', 'compiled');
  pgm.dropTable('realm_metas');
}
