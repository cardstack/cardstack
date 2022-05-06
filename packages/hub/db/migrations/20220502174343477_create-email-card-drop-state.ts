import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const EMAIL_CARD_DROP_STATE_TABLE = 'email_card_drop_state';
const EMAIL_CARD_DROP_STATE_SINGLETON_CONSTRAINT = 'email_card_drop_state_singleton';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(EMAIL_CARD_DROP_STATE_TABLE, {
    id: { type: 'integer', primaryKey: true, default: 1 },
    rate_limited: { type: 'boolean', notNull: true },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  // To restrict table to a single row: https://stackoverflow.com/a/29429083
  pgm.addConstraint(EMAIL_CARD_DROP_STATE_TABLE, EMAIL_CARD_DROP_STATE_SINGLETON_CONSTRAINT, { check: 'id = 1' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(EMAIL_CARD_DROP_STATE_TABLE, EMAIL_CARD_DROP_STATE_SINGLETON_CONSTRAINT);
  pgm.dropTable(EMAIL_CARD_DROP_STATE_TABLE);
}
