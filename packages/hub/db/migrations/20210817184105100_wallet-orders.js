const TABLE = 'wallet_orders';
const STATUS_ENUM = `${TABLE}_status_enum`;

exports.up = (pgm) => {
  pgm.createType(STATUS_ENUM, ['waiting-for-order', 'received-order', 'waiting-for-reservation', 'complete']);
  pgm.createTable(TABLE, {
    order_id: { type: 'string', primaryKey: true },
    user_address: { type: 'string', notNull: true },
    wallet_id: { type: 'string', notNull: true },
    status: { type: STATUS_ENUM, notNull: true },

    // these are allowed to be nullable since there is no guarantee of the order
    // that the card wallet app request to set orderId/reservationID correlation
    // will arrive and when the wyre webhook is called
    reservation_id: { type: 'string', notNull: false },
    custodial_transfer_id: { type: 'string', notNull: false },

    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // index for the query that wyre webhook admin transfer request will need to
  // update record
  pgm.createIndex(TABLE, ['custodial_transfer_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable(TABLE);
  pgm.dropType(STATUS_ENUM);
};
