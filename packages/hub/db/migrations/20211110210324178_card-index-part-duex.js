'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.down = exports.up = exports.shorthands = void 0;
exports.shorthands = undefined;
async function up(pgm) {
  pgm.addColumns('cards', {
    ancestors: { type: 'text[]' },
    searchData: { type: 'jsonb' },
  });
}
exports.up = up;
async function down(pgm) {
  pgm.dropColumn('cards', 'ancestors');
  pgm.dropColumn('cards', 'searchData');
}
exports.down = down;
