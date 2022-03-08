import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
const CARD_SPACES = 'card_spaces';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(CARD_SPACES, 'profile_name', { notNull: false });
  pgm.alterColumn(CARD_SPACES, 'profile_description', { notNull: false });
  pgm.alterColumn(CARD_SPACES, 'profile_button_text', { notNull: false });
  pgm.alterColumn(CARD_SPACES, 'profile_category', { notNull: false });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(CARD_SPACES, 'profile_name', { notNull: true });
  pgm.alterColumn(CARD_SPACES, 'profile_description', { notNull: true });
  pgm.alterColumn(CARD_SPACES, 'profile_button_text', { notNull: true });
  pgm.alterColumn(CARD_SPACES, 'profile_category', { notNull: true });
}
