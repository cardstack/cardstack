import Route from '@ember/routing/route';

export default class MediaRegistryItemEditRoute extends Route {
  async model() {
    let model = this.modelFor('media-registry.item');

    return model;
  }
}
