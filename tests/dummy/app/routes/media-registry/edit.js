import Route from '@ember/routing/route';

export default class MediaRegistryEditRoute extends Route {
  async model() {
    let model = this.modelFor('media-registry');

    return model;
  }
}
