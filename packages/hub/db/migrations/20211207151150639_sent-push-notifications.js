const SENT_PUSH_NOTIFICATIONS_TABLE = 'sent_push_notifications';

exports.up = (pgm) => {
  pgm.createTable(SENT_PUSH_NOTIFICATIONS_TABLE, {
    // This is our own id for the notification.
    notification_id: { type: 'string', primaryKey: true },
    notification_type: { type: 'string', notNull: true },
    notification_title: { type: 'string' },
    notification_body: { type: 'string', notNull: true },
    notification_data: { type: 'json' },
    // This is firebase's id for the sent message
    message_id: { type: 'string', notNull: true },
    network: { type: 'string' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(SENT_PUSH_NOTIFICATIONS_TABLE);
};
