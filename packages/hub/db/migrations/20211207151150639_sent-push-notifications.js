const SENT_PUSH_NOTIFICATIONS_TABLE = 'sent_push_notifications';

exports.up = (pgm) => {
  pgm.createTable(SENT_PUSH_NOTIFICATIONS_TABLE, {
    // This is our own id for the notification.
    notification_id: { type: 'string', primaryKey: true },
    push_client_id: { type: 'string' },
    notification_type: { type: 'string' },
    notification_title: { type: 'string' },
    notification_body: { type: 'string' },
    notification_data: { type: 'json' },
    // This is firebase's id for the sent message
    message_id: { type: 'string' },
    network: { type: 'string' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(SENT_PUSH_NOTIFICATIONS_TABLE);
};
