const RESERVATIONS = 'reservations';
const WALLET_ORDERS = 'wallet_orders';
const STATUS_ENUM = `${WALLET_ORDERS}_status_enum`;

exports.up = (pgm) => {
  pgm.createTable(RESERVATIONS, {
    id: { type: 'string', primaryKey: true },
    user_address: { type: 'string', notNull: true },
    sku: { type: 'string', notNull: true },
    transaction_hash: { type: 'string', notNull: false },
    prepaid_card_address: { type: 'string', notNull: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // clean out any test data
  pgm.sql(`UPDATE "wallet_orders" SET "reservation_id" = null`);

  pgm.addConstraint(WALLET_ORDERS, 'fk_reservation_id', {
    foreignKeys: {
      references: `${RESERVATIONS} (id)`,
      columns: 'reservation_id',
    },
  });

  pgm.addTypeValue(STATUS_ENUM, 'provisioning', { before: 'complete', ifNotExists: true });

  // index the query to get all the non-expired reservations
  pgm.createIndex(RESERVATIONS, ['updated_at', 'prepaid_card_address']);
  pgm.createIndex(RESERVATIONS, ['updated_at', 'prepaid_card_address', 'sku']);
};

exports.down = (pgm) => {
  pgm.dropConstraint(WALLET_ORDERS, 'fk_reservation_id');
  pgm.dropTable(RESERVATIONS);
};
