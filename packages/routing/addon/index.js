export function cardstackRoutes() {
  this.route('cardstack', { path: '/', resetNamespace: true }, function() {
    this.route('default-content', { path : '/:slug' });
    this.route('new-content', { path : '/:type/new' });
    this.route('content', { path : '/:type/:slug' });
  })
}
