import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const CARD_SPACES = 'card_spaces';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(CARD_SPACES, ['owner_address', 'url']);
  pgm.alterColumn(CARD_SPACES, 'merchant_id', { notNull: true });
  // FIXME this should actually be unique also, to enforce 1:1 vs 1:n… obvs answer is to have it all in the same table but meh
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(CARD_SPACES, 'merchant_id', { notNull: false });

  pgm.addColumns(CARD_SPACES, {
    owner_address: { type: 'string', notNull: true },
    url: { type: 'string', notNull: true },
  });
}
