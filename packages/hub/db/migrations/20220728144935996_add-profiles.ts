import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const idField = { id: { type: 'uuid', primaryKey: true } };

const merchantInfosFields = {
  name: { type: 'string', notNull: true },
  slug: { type: 'string', notNull: true },
  color: { type: 'string', notNull: true },
  text_color: { type: 'string', notNull: true },
  owner_address: { type: 'string', notNull: true },
};

const cardSpaceFields = {
  links: { type: 'json[]', notNull: true, default: '{}' },
  profile_image_url: { type: 'string' },
  profile_description: { type: 'string' },
};

export async function up(pgm: MigrationBuilder, run: () => Promise<void>): Promise<void> {
  const createdAtField = { created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') } };

  pgm.createTable('profiles', {
    ...idField,
    ...merchantInfosFields,
    ...cardSpaceFields,
    ...createdAtField,
  });

  pgm.createIndex('profiles', 'slug', { unique: true });

  await forceRun(pgm, run);

  await pgm.db.query(`
    INSERT INTO profiles
    SELECT
      m.id, m.name, m.slug, m.color, m.text_color, m.owner_address,
      c.links, c.profile_image_url, c.profile_description,
      m.created_at
    FROM merchant_infos as m
    LEFT JOIN card_spaces AS c ON m.id = c.merchant_id
  `);

  await pgm.db.query('DROP TABLE card_spaces');
  await pgm.db.query('DROP TABLE merchant_infos');
}

export async function down(pgm: MigrationBuilder, run: () => any): Promise<void> {
  const createdAtField = { created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') } };

  pgm.createTable('merchant_infos', { ...idField, ...merchantInfosFields, ...createdAtField });
  pgm.createTable('card_spaces', {
    ...idField,
    ...cardSpaceFields,
    merchant_id: { type: 'uuid', references: 'merchant_infos' },
    ...createdAtField,
  });

  pgm.createIndex('merchant_infos', 'slug', { unique: true });

  await forceRun(pgm, run);

  await pgm.db.query(`
    INSERT INTO merchant_infos
    SELECT id, name, slug, color, text_color, owner_address, created_at
    FROM profiles
  `);

  await forceRun(pgm, run);

  await pgm.db.query(`
    INSERT INTO card_spaces
    SELECT id, links, profile_image_url, profile_description, id, created_at
    FROM profiles
  `);

  await pgm.db.query('DROP TABLE profiles');
}

// This empties the query queue so future operations on dependent tables are able to complete
async function forceRun(pgm: MigrationBuilder, run: () => Promise<void>) {
  await run();
  await pgm.db.query('SELECT NOW()');
}
