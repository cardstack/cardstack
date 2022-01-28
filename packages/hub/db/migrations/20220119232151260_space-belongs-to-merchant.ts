import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const CARD_SPACES = 'card_spaces';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(CARD_SPACES, ['owner_address', 'url']);
  pgm.alterColumn(CARD_SPACES, 'merchant_id', { notNull: true });
  pgm.createIndex(CARD_SPACES, 'merchant_id', { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(CARD_SPACES, 'merchant_id');
  pgm.alterColumn(CARD_SPACES, 'merchant_id', { notNull: false });

  pgm.addColumns(CARD_SPACES, {
    owner_address: { type: 'string', notNull: true },
    url: { type: 'string', notNull: true },
  });
}
