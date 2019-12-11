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

  pgm.createType('job_statuses', ['waiting', 'running', 'completed', 'failed', 'fulfilled', 'rejected']);
  /* eslint-disable @typescript-eslint/camelcase */
  pgm.createTable('jobs', {
    id: 'id', // shorthand for primary key that is an auto incremented id
    name: {
      type: 'varchar',
      notNull: true,
    },
    args: 'jsonb',
    status: {
      type: 'job_statuses',
      notNull: true,
    },
    published_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    finished_at: {
      type: 'timestamp',
    },
  });
}
