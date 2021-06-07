import MediaRegistryIndexController from 'dummy/controllers/media-registry/index';
import { action } from '@ember/object';

export default class MediaRegistryCollectionController extends MediaRegistryIndexController {
  @action
  transitionToIsolate(item) {
    this.transitionToRoute('media-registry.item', item.id);
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry.collection', this.model.id);
  }

  @action
  transitionToEdit() {
    this.transitionToRoute('media-registry.collection.edit', this.model.id);
  }
}
