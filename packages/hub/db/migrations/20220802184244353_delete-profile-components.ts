import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import { cardSpaceFields, merchantInfosFields } from './20220728144935996_add-profiles';

export const shorthands: ColumnDefinitions | undefined = undefined;

const idField = { id: { type: 'uuid', primaryKey: true } };

export async function up(pgm: MigrationBuilder): Promise<void> {
  await pgm.db.query('DROP TABLE card_spaces');
  await pgm.db.query('DROP TABLE merchant_infos');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const createdAtField = { created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') } };

  pgm.createTable('merchant_infos', { ...idField, ...merchantInfosFields, ...createdAtField });
  pgm.createTable('card_spaces', {
    ...idField,
    ...cardSpaceFields,
    merchant_id: { type: 'uuid', references: 'merchant_infos' },
    ...createdAtField,
  });

  pgm.createIndex('merchant_infos', 'slug', { unique: true });
}
