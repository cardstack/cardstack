const NOTIFICATION_TYPES_TABLE = 'notification_types';
const STATUS_ENUM = `${NOTIFICATION_TYPES_TABLE}_status_enum`;

exports.up = (pgm) => {
  pgm.createType(STATUS_ENUM, ['enabled', 'disabled']);

  pgm.createTable(NOTIFICATION_TYPES_TABLE, {
    id: { type: 'uuid', primaryKey: true },
    notification_type: { type: 'string', notNull: true },
    default_status: { type: STATUS_ENUM, notNull: true, default: 'enabled' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable(NOTIFICATION_TYPES_TABLE);
  pgm.dropType(STATUS_ENUM);
};
