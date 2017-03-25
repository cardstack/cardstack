export function cardstackRoutes(where) {
  mountRoutes.apply(where);
}

function mountRoutes() {
  this.route('cardstack', { path: '/', resetNamespace: true }, function() {
    this.route('new-content', { path : '/:type/new' });
    this.route('content', { path : '/:type/:id' });
  })
}
