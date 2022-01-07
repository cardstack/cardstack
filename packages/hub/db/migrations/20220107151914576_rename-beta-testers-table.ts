import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameTable('beta_testers', 'card_drop_recipients');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameTable('card_drop_recipients', 'beta_testers');
}
