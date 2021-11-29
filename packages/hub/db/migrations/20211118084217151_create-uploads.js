const UPLOADS_TABLE = 'uploads';

exports.up = (pgm) => {
  pgm.createTable(UPLOADS_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    cid: { type: 'string', notNull: true },
    service: { type: 'string', notNull: true },
    url: { type: 'string', notNull: true },
    filename: { type: 'string', notNull: true },
    size: { type: 'integer', notNull: true },
    type: { type: 'string', notNull: true },
    owner_address: { type: 'string', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(UPLOADS_TABLE);
};
