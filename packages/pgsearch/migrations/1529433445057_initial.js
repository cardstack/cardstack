
exports.up = pgm => {
    pgm.createTable("documents", {
        type: "varchar",
        id: "varchar",
        branch: "varchar",
        search_doc: "jsonb",
        pristine_doc: "jsonb"
    });
    pgm.addConstraint("documents", "documents_pkey", { primaryKey: ["type", "id", "branch"]});

    pgm.createTable("meta", {
        id: "varchar",
        branch: "varchar",
        doc: "jsonb"
    });
    pgm.addConstraint("meta", "meta_pkey", { primaryKey: ["id", "branch"]});
};

