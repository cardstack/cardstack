const RESERVATIONS = 'reservations';
const WALLET_ORDERS = 'wallet_orders';

exports.up = (pgm) => {
  pgm.createIndex(RESERVATIONS, ['user_address']);
  pgm.createIndex(WALLET_ORDERS, ['reservation_id']);
};

exports.down = (pgm) => {
  pgm.dropIndex(RESERVATIONS, ['user_address']);
  pgm.dropIndex(WALLET_ORDERS, ['reservation_id']);
};
