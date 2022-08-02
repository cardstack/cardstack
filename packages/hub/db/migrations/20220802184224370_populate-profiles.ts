import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  await pgm.db.query(`
    INSERT INTO profiles
    SELECT
      m.id, m.name, m.slug, m.color, m.text_color, m.owner_address,
      c.links, c.profile_image_url, c.profile_description,
      m.created_at
    FROM merchant_infos as m
    LEFT JOIN card_spaces AS c ON m.id = c.merchant_id
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  await pgm.db.query(`
    INSERT INTO merchant_infos
    SELECT id, name, slug, color, text_color, owner_address, created_at
    FROM profiles
  `);

  await pgm.db.query(`
    INSERT INTO card_spaces
    SELECT id, links, profile_image_url, profile_description, id, created_at
    FROM profiles
  `);
}
