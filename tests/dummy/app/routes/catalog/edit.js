import Route from '@ember/routing/route';

export default class EditRoute extends Route {
  async beforeModel(transition) {
    await super.beforeModel(transition);

    // hard coded route
    this.transitionTo('catalog.edit', 'article');
  }
}
