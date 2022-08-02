import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

const idField = { id: { type: 'uuid', primaryKey: true } };

export const merchantInfosFields = {
  name: { type: 'string', notNull: true },
  slug: { type: 'string', notNull: true },
  color: { type: 'string', notNull: true },
  text_color: { type: 'string', notNull: true },
  owner_address: { type: 'string', notNull: true },
};

export const cardSpaceFields = {
  links: { type: 'json[]', notNull: true, default: '{}' },
  profile_image_url: { type: 'string' },
  profile_description: { type: 'string' },
};

export async function up(pgm: MigrationBuilder): Promise<void> {
  const createdAtField = { created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') } };

  pgm.createTable('profiles', {
    ...idField,
    ...merchantInfosFields,
    ...cardSpaceFields,
    ...createdAtField,
  });

  pgm.createIndex('profiles', 'slug', { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  await pgm.dropTable('profiles');
}
