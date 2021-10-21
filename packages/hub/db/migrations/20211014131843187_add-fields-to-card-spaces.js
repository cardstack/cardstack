const TABLE = 'card_spaces';

exports.up = (pgm) => {
  pgm.addColumns(TABLE, {
    bio_title: { type: 'string' },
    bio_description: { type: 'string' },
    links: { type: 'json[]', notNull: true, default: '{}' },
    donation_title: { type: 'string' },
    donation_description: { type: 'string' },
    merchant_id: { type: 'uuid', references: 'merchant_infos' },
    donation_suggestion_amount_1: { type: 'integer' },
    donation_suggestion_amount_2: { type: 'integer' },
    donation_suggestion_amount_3: { type: 'integer' },
    donation_suggestion_amount_4: { type: 'integer' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns(TABLE, [
    'bio_title',
    'bio_description',
    'links',
    'donation_title',
    'donation_description',
    'merchant_id',
    'donation_suggestion_amount_1',
    'donation_suggestion_amount_2',
    'donation_suggestion_amount_3',
    'donation_suggestion_amount_4',
  ]);
};
