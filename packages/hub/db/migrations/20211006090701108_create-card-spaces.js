const TABLE = 'card_spaces';

exports.up = (pgm) => {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true },
    url: { type: 'string', notNull: true },
    profile_cover_image_url: { type: 'string' },
    profile_name: { type: 'string', notNull: true },
    profile_image_url: { type: 'string' },
    profile_description: { type: 'string', notNull: true },
    profile_button_text: { type: 'string', notNull: true },
    profile_category: { type: 'string', notNull: true },
    owner_address: { type: 'string', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(TABLE, 'url', { unique: true });
};

exports.down = (pgm) => {
  pgm.dropTable(TABLE);
};
