const PATTERNS_TABLE = 'prepaid_card_patterns';
const COLOR_SCHEMES_TABLE = 'prepaid_card_color_schemes';

exports.up = (pgm) => {
  pgm.createTable(PATTERNS_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    pattern_url: { type: 'string' },
    description: { type: 'string', notNull: true },
  });
  pgm.createTable(COLOR_SCHEMES_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    background: { type: 'string', notNull: true },
    pattern_color: { type: 'string', notNull: true },
    text_color: { type: 'string', notNull: true },
    description: { type: 'string', notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(PATTERNS_TABLE);
  pgm.dropTable(COLOR_SCHEMES_TABLE);
};
