module.exports = function() {
  return [{
    path: '/cards/:type/:id',
    query: { filter: { type: ':type', id: { exact: ':id' } } }
  }];
};