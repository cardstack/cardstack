import MediaRegistryIndexController from './index';
import { action } from '@ember/object';
import { dasherize } from '@ember/string';

export default class MediaRegistryCollectionController extends MediaRegistryIndexController {
  @action
  transitionToIsolate(item) {
    let itemId = dasherize(item.song_title.trim());
    this.transitionToRoute('media-registry.item', itemId);
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry.collection', this.model.title);
  }

  @action
  transitionToEdit() {
    this.transitionToRoute('media-registry.collection.edit', this.model.title);
  }
}
