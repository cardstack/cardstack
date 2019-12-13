import { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder) {
  /* eslint-disable @typescript-eslint/camelcase */
  pgm.createTable('cards', {
    realm: 'varchar',
    original_realm: 'varchar',
    local_id: 'varchar',
    pristine_doc: 'jsonb',
    generation: 'bigint',
  });
  /* eslint-enable @typescript-eslint/camelcase */
  pgm.sql('ALTER TABLE cards SET UNLOGGED');
  pgm.addConstraint('cards', 'cards_pkey', {
    primaryKey: ['realm', 'original_realm', 'local_id'],
  });

  pgm.createTable('meta', {
    realm: 'varchar',
    params: 'jsonb',
  });
  pgm.sql('ALTER TABLE meta SET UNLOGGED');
  pgm.addConstraint('meta', 'meta_pkey', {
    primaryKey: ['realm'],
  });

  pgm.createTable('queues', {
    name: {
      type: 'varchar',
      primaryKey: true,
    },
  });

  pgm.createType('job_statuses', ['not done', 'completed', 'failed', 'fulfilled', 'rejected']);
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
      default: 'not done',
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
      references: 'queues',
      notNull: true,
    },
    result: 'jsonb',
  });
  pgm.sql('ALTER TABLE jobs SET UNLOGGED');
}
