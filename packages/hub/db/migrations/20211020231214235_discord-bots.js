/* eslint-disable camelcase */

exports.shorthands = undefined;

const TABLE = 'discord_bots';
const STATUS_ENUM = `${TABLE}_status_enum`;

exports.up = (pgm) => {
  pgm.createType(STATUS_ENUM, ['connecting', 'connected', 'listening', 'disconnected', 'unresponsive']);
  pgm.createTable(TABLE, {
    bot_id: { type: 'string', primaryKey: true },
    bot_type: { type: 'string', notNull: true },
    status: { type: STATUS_ENUM, notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    last_message_id: { type: 'string', notNull: false },
  });
  pgm.createIndex(TABLE, ['bot_type', 'status']);
  pgm.createTrigger(
    TABLE,
    'discord_bots_updated_trigger',
    {
      when: 'AFTER',
      level: 'ROW',
      operation: 'INSERT OR UPDATE',
      language: 'plpgsql',
      replace: true,
    },
    `
    DECLARE
      payload TEXT;
    BEGIN
    IF NEW."last_message_id" IS NOT NULL THEN
      payload := '{ "id": "' || NEW."last_message_id" || '", "bot_type": "' || NEW."bot_type" || '" }';
      PERFORM pg_notify('discord_bot_message_processing', payload);
    END IF;
    IF OLD."status" = 'listening' AND NEW."status" = 'disconnected' THEN
      payload := '{ "bot_type": "' || NEW."bot_type" || '", "status": "' || NEW."status"   ||'" }';
      PERFORM pg_notify('discord_bot_status', payload);
    END IF;
    RETURN NEW;
  END
  `
  );
};

exports.down = (pgm) => {
  pgm.dropTrigger(TABLE, 'discord_bots_updated_trigger');
  pgm.dropTable(TABLE);
  pgm.dropType(STATUS_ENUM);
};

/* To verify the listen/notify functionality, run the following in a SQL console...

LISTEN discord_bot_status;
LISTEN discord_bot_message_processing;

INSERT INTO discord_bots (bot_id, bot_type, status) VALUES ('8e566895-128a-4b83-a28a-c10fbf6e8987', 'test', 'connecting');
UPDATE discord_bots SET status = 'connected' WHERE bot_id = '8e566895-128a-4b83-a28a-c10fbf6e8987';
UPDATE discord_bots SET status = 'listening' WHERE bot_id = '8e566895-128a-4b83-a28a-c10fbf6e8987';
UPDATE discord_bots SET last_message_id = '4532234' WHERE bot_id = '8e566895-128a-4b83-a28a-c10fbf6e8987';
UPDATE discord_bots SET status = 'disconnected' WHERE bot_id = '8e566895-128a-4b83-a28a-c10fbf6e8987';

*/
