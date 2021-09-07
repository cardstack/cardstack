const TABLE = 'merchant_infos';

exports.up = (pgm) => {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'string', notNull: true },
    slug: { type: 'string', notNull: true },
    color: { type: 'string', notNull: true },
    text_color: { type: 'string', notNull: true },
    owner_address: { type: 'string', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(TABLE, 'slug', { unique: true });
};

exports.down = (pgm) => {
  pgm.dropTable(TABLE);
};
