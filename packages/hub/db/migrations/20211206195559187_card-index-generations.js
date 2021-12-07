'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.down = exports.up = exports.shorthands = void 0;
exports.shorthands = undefined;
async function up(pgm) {
  pgm.sql('DELETE from cards;');
  pgm.addColumns('cards', {
    realm: { type: 'text', notNull: true },
    generation: { type: 'integer' },
  });
}
exports.up = up;
async function down(pgm) {
  pgm.dropColumn('cards', 'realm');
  pgm.dropColumn('cards', 'generation');
}
exports.down = down;
