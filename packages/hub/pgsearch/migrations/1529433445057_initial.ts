import { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder) {
  /* eslint-disable @typescript-eslint/camelcase */
  pgm.createTable('cards', {
    cs_realm: 'varchar',
    cs_original_realm: 'varchar',
    cs_id: 'varchar',
    pristine_doc: 'jsonb',
    generation: 'bigint',
    search_doc: 'jsonb',
  });
  /* eslint-enable @typescript-eslint/camelcase */
  pgm.sql('ALTER TABLE cards SET UNLOGGED');
  pgm.addConstraint('cards', 'cards_pkey', {
    primaryKey: ['cs_realm', 'cs_original_realm', 'cs_id'],
  });

  /* eslint-disable @typescript-eslint/camelcase */
  pgm.createTable('meta', {
    cs_realm: 'varchar',
    params: 'jsonb',
  });
  /* eslint-enable @typescript-eslint/camelcase */

  pgm.sql('ALTER TABLE meta SET UNLOGGED');
  pgm.addConstraint('meta', 'meta_pkey', {
    primaryKey: ['cs_realm'],
  });

  pgm.createType('job_statuses', ['unfulfilled', 'resolved', 'rejected']);
  /* eslint-disable @typescript-eslint/camelcase */
  pgm.createTable('jobs', {
    id: 'id', // shorthand for primary key that is an auto incremented id
    category: {
      type: 'varchar',
      notNull: true,
    },
    args: 'jsonb',
    status: {
      type: 'job_statuses',
      default: 'unfulfilled',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    finished_at: {
      type: 'timestamp',
    },
    queue: {
      type: 'varchar',
      notNull: true,
    },
    result: 'jsonb',
  });
  pgm.sql('ALTER TABLE jobs SET UNLOGGED');
}
