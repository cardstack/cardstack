import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
const CARD_INDEX = 'card_index';
// const REALMS = 'realms';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(CARD_INDEX, {
    url: { type: 'string', primaryKey: true, notNull: true },
    // realm // Do we want a denormalized reference to a realm?
    name: { type: 'string', notNull: true },
    features: { type: 'string[]' }, // [primitive, route, etc]?
    data: { type: 'json' },
    adoptsFrom: { type: 'string[]' }, //denormalized adoption chain as an array of urls?
    schemaModule: { type: 'string', notNull: true },

    // Pojo of field definitions
    // TODO: Do we need relationships to other cards that are fields? Can you have an
    // array of foreign keys or do we need to have join tables?
    fields: { type: 'json' },

    views: { type: 'json' }, //Pojo of view definitions
  });

  // TODO: Indexes
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(CARD_INDEX);
}
