exports.shorthands = undefined;

exports.up = pgm => {
  pgm.addColumns('documents', {
    q: { type: 'tsvector' },
  });
};
