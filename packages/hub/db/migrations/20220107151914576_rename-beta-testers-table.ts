import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameConstraint('beta_testers', 'beta_testers_pkey', 'card_drop_recipients_pkey');
  pgm.renameTable('beta_testers', 'card_drop_recipients');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameConstraint('card_drop_recipients', 'card_drop_recipients_pkey', 'beta_testers_pkey');
  pgm.renameTable('card_drop_recipients', 'beta_testers');
}
