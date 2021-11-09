'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.down = exports.up = void 0;
async function up(pgm) {
  pgm.createTable('cards', {
    url: { type: 'string', primaryKey: true, notNull: true },
    data: { type: 'jsonb' },
  });
}
exports.up = up;
async function down(pgm) {
  pgm.dropTable('cards');
}
exports.down = down;
//# sourceMappingURL=20211013155536724_card-index.js.map
