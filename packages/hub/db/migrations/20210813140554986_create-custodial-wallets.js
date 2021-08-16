const TABLE = 'custodial_wallets';

exports.up = (pgm) => {
  pgm.createTable(TABLE, {
    user_address: { type: 'string', primaryKey: true }, // This is the card wallet EOA address
    wyre_wallet_id: { type: 'string', notNull: true },
    deposit_address: { type: 'string', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex(TABLE, 'wyre_wallet_id', { unique: true });
};

exports.down = (pgm) => {
  pgm.dropTable(TABLE);
};
