exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable("transactions", {
        transaction_hash: "varchar",
        block_number: "bigint",
        block_hash: "varchar",
        from_address: "varchar",
        to_address: "varchar",
        transaction_value: "varchar",
        timestamp: "bigint",
        transaction_nonce: "bigint",
        transaction_index: "bigint",
        gas: "bigint",
        gas_price: "varchar",
        gas_used: "bigint",
        cumulative_gas_used: "bigint",
        transaction_successful: "bool"
    });

    pgm.sql('ALTER TABLE transactions SET UNLOGGED');
    pgm.addConstraint("transactions", "transactions_pkey", { primaryKey: ["transaction_hash"]});
    pgm.createIndex("transactions", "block_number");
    pgm.createIndex("transactions", "lower(from_address)");
    pgm.createIndex("transactions", "lower(to_address)");
};