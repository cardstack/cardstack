const LATEST_EVENT_BLOCK_TABLE = 'latest_event_block';
const LATEST_EVENT_SINGLETON_CONSTRAINT = 'latest_event_block_singleton';

exports.TABLE = LATEST_EVENT_BLOCK_TABLE;

exports.up = async function up(pgm) {
  pgm.createTable(LATEST_EVENT_BLOCK_TABLE, {
    id: { type: 'integer', primaryKey: true, default: 1 },
    block_number: { type: 'integer', notNull: true },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // To restrict table to a single row: https://stackoverflow.com/a/29429083
  pgm.addConstraint(LATEST_EVENT_BLOCK_TABLE, LATEST_EVENT_SINGLETON_CONSTRAINT, { check: 'id = 1' });
};

exports.down = async function down(pgm) {
  pgm.dropConstraint(LATEST_EVENT_BLOCK_TABLE, LATEST_EVENT_SINGLETON_CONSTRAINT);
  pgm.dropTable(LATEST_EVENT_BLOCK_TABLE);
};
