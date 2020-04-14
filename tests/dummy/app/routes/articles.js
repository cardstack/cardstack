import BoxelizedRoute from '@cardstack/boxel/routes/boxelized';

export default class ArticlesRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model({ id }) {
    return this.store.findRecord('article', id);
  }
}
