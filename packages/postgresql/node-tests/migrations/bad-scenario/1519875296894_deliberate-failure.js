exports.up = (pgm) => {
  pgm.createTable('comments', {
    id: { type: 'bigint', primaryKey: true },
    title: { type: 'varchar' }
  });

  pgm.addColumns('not_a_real_table', {
    title: { type: 'varchar' }
  });
};
