const NOTIFICATION_PREFERENCES_TABLE = 'notification_preferences';
const STATUS_ENUM = `${NOTIFICATION_PREFERENCES_TABLE}_status_enum`;

exports.up = (pgm) => {
  pgm.createType(STATUS_ENUM, ['enabled', 'disabled']);

  pgm.createTable(NOTIFICATION_PREFERENCES_TABLE, {
    owner_address: { type: 'string', notNull: true },
    notification_type_id: { type: 'uuid', notNull: true, references: 'notification_types' },
    push_client_id: { type: 'string', notNull: true },
    status: { type: STATUS_ENUM, notNull: true, default: 'enabled' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(NOTIFICATION_PREFERENCES_TABLE, 'owner_address');
  pgm.createIndex(NOTIFICATION_PREFERENCES_TABLE, ['owner_address', 'notification_type_id', 'push_client_id'], {
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable(NOTIFICATION_PREFERENCES_TABLE);
  pgm.dropType(STATUS_ENUM);
};
