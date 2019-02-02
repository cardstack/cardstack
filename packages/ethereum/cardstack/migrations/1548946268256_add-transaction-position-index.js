exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createIndex("transactions", "transaction_index");
    pgm.createIndex("transactions", "timestamp");
};

