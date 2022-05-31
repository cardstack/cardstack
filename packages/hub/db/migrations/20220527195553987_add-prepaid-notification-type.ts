import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(`
    INSERT INTO notification_types (id, notification_type, default_status)
    VALUES (
      '27fbf982-2fed-4f96-b730-0a71964d3370',
      'prepaid_card_drop',
      'enabled'
    )
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query("DELETE FROM notification_types WHERE id = '27fbf982-2fed-4f96-b730-0a71964d3370'");
}
