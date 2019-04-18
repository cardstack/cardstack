exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('documents', 'documents_pkey');
  pgm.dropColumns('documents', 'type');
  pgm.addColumns("documents", {
    package_name: { type: "varchar" },
    package_version: { type: "varchar" },
    snapshot_version: { type: "varchar" },
  });

  pgm.addConstraint("documents", "documents_pkey", { primaryKey: ["source", "package_name", "id", "snapshot_version"]});
  pgm.createIndex("documents", "snapshot_version");
};