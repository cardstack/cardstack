const TABLE = 'wyre_prices';

exports.up = (pgm) => {
  pgm.createTable(TABLE, {
    sku: { type: 'string', primaryKey: true },
    source_currency: { type: 'string', notNull: true },
    dest_currency: { type: 'string', notNull: true },
    source_currency_price: { type: 'numeric', notNull: true },
    includes_fee: { type: 'boolean', notNull: true, default: false },
    disabled: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(TABLE, ['disabled']);
};

exports.down = (pgm) => {
  pgm.dropTable(TABLE);
};
