const PUSH_NOTIFICATION_REGISTRATIONS_TABLE = 'push_notification_registrations';

exports.up = (pgm) => {
  pgm.createTable(PUSH_NOTIFICATION_REGISTRATIONS_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    owner_address: { type: 'string', notNull: true },
    push_client_id: { type: 'string', notNull: true },
    disabled_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(PUSH_NOTIFICATION_REGISTRATIONS_TABLE, ['owner_address', 'push_client_id'], { unique: true });
};

exports.down = (pgm) => {
  pgm.dropTable(PUSH_NOTIFICATION_REGISTRATIONS_TABLE);
};
