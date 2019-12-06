import { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder) {
  /* eslint-disable @typescript-eslint/camelcase */
  pgm.createTable('cards', {
    realm: 'varchar',
    original_realm: 'varchar',
    local_id: 'varchar',
    pristine_doc: 'jsonb',
  });
  /* eslint-enable @typescript-eslint/camelcase */
  pgm.sql('ALTER TABLE cards SET UNLOGGED');
  pgm.addConstraint('cards', 'cards_pkey', {
    primaryKey: ['realm', 'original_realm', 'local_id'],
  });
}
