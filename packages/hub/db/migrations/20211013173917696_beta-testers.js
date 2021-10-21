const BETA_TESTERS = 'beta_testers';
const DM_CHANNELS = 'dm_channels';

exports.up = (pgm) => {
  pgm.createTable(DM_CHANNELS, {
    channel_id: { type: 'string', primaryKey: true },
    user_id: { type: 'string', notNull: true },
    command: { type: 'string', notNull: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createTable(BETA_TESTERS, {
    user_id: { type: 'string', primaryKey: true },
    user_name: { type: 'string', notNull: true },
    address: { type: 'string', notNull: false },
    airdrop_txn_hash: { type: 'string', notNull: false },
    airdrop_prepaid_card: { type: 'string', notNull: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(BETA_TESTERS);
  pgm.dropTable(DM_CHANNELS);
};
