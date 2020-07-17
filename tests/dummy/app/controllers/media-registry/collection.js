import MediaRegistryIndexController from './index';
import { action } from '@ember/object';
import { formatId } from '@cardstack/boxel/utils/format-id';

export default class MediaRegistryCollectionController extends MediaRegistryIndexController {
  @action
  transitionToIsolate(item) {
    this.transitionToRoute('media-registry.item', formatId(item.song_title));
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
