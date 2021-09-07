/* eslint-disable camelcase */

const TABLE = 'prepaid_card_customizations';

exports.up = (pgm) => {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true },
    owner_address: { type: 'string', notNull: true },
    issuer_name: { type: 'string', notNull: true },
    color_scheme_id: { type: 'uuid', references: 'prepaid_card_color_schemes', notNull: true },
    pattern_id: { type: 'uuid', references: 'prepaid_card_patterns', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(TABLE);
};
