import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const CARD_SPACES = 'card_spaces';
const MERCHANT_INFOS = 'merchant_infos';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(CARD_SPACES, ['url']);

  pgm.createIndex(MERCHANT_INFOS, ['owner_address']);
  pgm.addConstraint(MERCHANT_INFOS, 'merchant_infos_owner_address_unique', { unique: 'owner_address' });
  pgm.addConstraint(CARD_SPACES, 'fk_owner_address', {
    foreignKeys: {
      references: `${MERCHANT_INFOS} (owner_address)`,
      columns: 'owner_address',
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(CARD_SPACES, 'fk_owner_address');
  pgm.dropConstraint(MERCHANT_INFOS, 'merchant_infos_owner_address_unique');
  pgm.dropIndex(MERCHANT_INFOS, ['owner_address']);

  pgm.addColumns(CARD_SPACES, {
    url: { type: 'string', notNull: true },
  });
}
