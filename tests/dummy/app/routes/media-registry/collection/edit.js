import Route from '@ember/routing/route';

export default class MediaRegistryCollectionEditRoute extends Route {
  async model() {
    let model = this.modelFor('media-registry.collection');

    return model;
  }
}
