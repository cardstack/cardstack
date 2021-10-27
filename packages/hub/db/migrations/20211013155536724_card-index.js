"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = exports.shorthands = void 0;
const CARD_INDEX = 'card_index';
// const REALMS = 'realms';
exports.shorthands = undefined;
async function up(pgm) {
    pgm.createTable(CARD_INDEX, {
        url: { type: 'string', primaryKey: true, notNull: true },
        // realm // Do we want a denormalized reference to a realm?
        name: { type: 'string', notNull: true },
        features: { type: 'string[]' },
        data: { type: 'json' },
        adoptsFrom: { type: 'string[]' },
        schemaModule: { type: 'string', notNull: true },
        // Pojo of field definitions
        // TODO: Do we need relationships to other cards that are fields? Can you have an
        // array of foreign keys or do we need to have join tables?
        fields: { type: 'json' },
        views: { type: 'json' }, //Pojo of view definitions
    });
    // TODO: Indexes
}
exports.up = up;
async function down(pgm) {
    pgm.dropTable(CARD_INDEX);
}
exports.down = down;
//# sourceMappingURL=20211013155536724_card-index.js.map