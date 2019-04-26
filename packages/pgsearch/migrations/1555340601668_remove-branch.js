exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('documents', 'documents_pkey');
  pgm.dropConstraint('meta', 'meta_pkey');
  pgm.dropColumns('documents', 'branch');
  pgm.dropColumns('meta', 'branch');

  pgm.addConstraint("documents", "documents_pkey", { primaryKey: ["type", "id"]});
  pgm.addConstraint("meta", "meta_pkey", { primaryKey: ["id"]});
};

