import MediaRegistryIndexController from 'dummy/controllers/media-registry/index';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class MediaRegistryCollectionController extends MediaRegistryIndexController {
  @service router;

  @action
  transitionToIsolate(item) {
    this.router.transitionTo('media-registry.item', item.id);
  }

  @action
  transitionToView() {
    this.router.transitionTo('media-registry.collection', this.model.id);
  }

  @action
  transitionToEdit() {
    this.router.transitionTo('media-registry.collection.edit', this.model.id);
  }
}
