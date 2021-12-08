const SENT_PUSH_NOTIFICATIONS_TABLE = 'sent_push_notifications';

exports.up = (pgm) => {
  pgm.createTable(SENT_PUSH_NOTIFICATIONS_TABLE, {
    transaction_hash: { type: 'string', notNull: true },
    owner_address: { type: 'string', notNull: true },
    push_client_id: { type: 'string', notNull: true },
    notification_type: { type: 'string', notNull: true },
    notification_title: { type: 'string' },
    notification_body: { type: 'string', notNull: true },
    notification_data: { type: 'json' },
    message_id: { type: 'string', notNull: true },
    network: { type: 'string' },
  });

  pgm.createIndex(SENT_PUSH_NOTIFICATIONS_TABLE, ['transaction_hash', 'owner_address', 'push_client_id'], {
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable(SENT_PUSH_NOTIFICATIONS_TABLE);
};
