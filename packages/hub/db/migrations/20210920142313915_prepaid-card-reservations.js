const RESERVATIONS = 'reservations';
const WALLET_ORDERS = 'wallet_orders';
const STATUS_ENUM = `${WALLET_ORDERS}_status_enum`;

exports.up = (pgm) => {
  pgm.createTable(RESERVATIONS, {
    id: 'id',
    user_address: { type: 'string', notNull: true },
    sku: { type: 'string', notNull: true },
    prepaid_card_address: { type: 'string', notNull: false },
    status: { type: STATUS_ENUM, notNull: true },
    created_at: { type: 'timestamp', notNull: true },
    updated_at: { type: 'timestamp', notNull: true },
  });

  pgm.addConstraint(WALLET_ORDERS, 'reservation_id_fk', {
    foreignKeys: {
      references: { table: RESERVATIONS, column: 'id' },
      columns: 'reservation_id',
    },
  });
  pgm.addTypeValue(STATUS_ENUM, 'provisioning', { before: 'completed', ifNotExists: true });

  // index for the query to find all pending reservations for a sku
  pgm.createIndex(RESERVATIONS, ['sku', 'prepaid_card_address', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable(RESERVATIONS);
  pgm.dropConstraint(WALLET_ORDERS, 'reservation_id_fk');
};
