import { action } from '@ember/object';
import MediaRegistryCollectionController from 'dummy/controllers/media-registry/collection';

export default class MediaRegistryCollectionEditController extends MediaRegistryCollectionController {
  removed = [];

  @action
  transitionToPrevious() {
    this.transitionToRoute('media-registry.collection', this.model.title);
  }

  @action removeItem(item) {
    this.removed.push(item);
    return this.model.collection.filter(i => !this.removed.includes(i));
  }
}
