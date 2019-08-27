import BoxelizedRoute from 'boxel/routes/boxelized';

export default class ArticlesRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model({ id }) {
    return this.store.peekRecord('article', id);
  }
}
