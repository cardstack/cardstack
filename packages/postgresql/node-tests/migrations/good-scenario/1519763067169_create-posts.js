exports.up = (pgm) => {
  pgm.createTable('posts', {
    id: { type: 'bigint', primaryKey: true },
    title: { type: 'varchar' }
  });
};
