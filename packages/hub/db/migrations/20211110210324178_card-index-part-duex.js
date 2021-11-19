'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.down = exports.up = exports.shorthands = void 0;
exports.shorthands = undefined;
async function up(pgm) {
  pgm.addColumn('cards', {
    ancestors: { type: 'text[]' },
  });
}
exports.up = up;
async function down(pgm) {
  pgm.dropColumn('cards', 'ancestors');
}
exports.down = down;
//# sourceMappingURL=20211110210324178_card-index-part-duex.js.map
