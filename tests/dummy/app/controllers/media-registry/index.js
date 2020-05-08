import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { dasherize } from '@ember/string';

export default class MediaRegistryIndexController extends Controller {
  @action
  togglePin(item) {
    set(item, 'pinned', !item.pinned);
  }

  @action
  toggleSelect(item) {
    let collection = this.model.collection;
    set(item, 'selected', !item.selected);
    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
    set(collection, 'selectedAll', collection.length === collection.selectedItemCount);
  }

  @action
  selectOrTransition(item) {
    if (this.model.collection.selectedItemCount > 0) {
      this.toggleSelect(item);
    } else {
      let itemId = dasherize(item.catalog_title.trim());
      this.transitionToRoute('media-registry.collection', itemId);
    }
  }
}
