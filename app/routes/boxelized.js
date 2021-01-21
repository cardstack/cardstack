import Route from '@ember/routing/route';

export default class BoxelizedRoute extends Route {
  renderTemplate(/*controller, model*/) {
    this.render(this.routeName, {
      into: 'application',
      outlet: this.boxelPlane,
    });
  }
}
