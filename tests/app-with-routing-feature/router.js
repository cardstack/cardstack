module.exports = function() {
  return [{
    path: '/cards/:type/:id',
    query: { filter: { type: { exact: ':type' }, id: { exact: ':id' } } }
  }];
};