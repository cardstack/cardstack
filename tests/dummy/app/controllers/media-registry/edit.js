import Controller from '@ember/controller';
import { action } from '@ember/object';
import { dasherize } from '@ember/string';
import { get } from '@ember/object';
import { compare } from '@ember/utils';

export default class MediaRegistryEditController extends Controller {
  removed = [];

  @action
  transitionToPrevious() {
    this.transitionToRoute('media-registry');
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

  @action removeItem(item) {
    this.removed.push(item);
    return this.model.collection.filter(i => !this.removed.includes(i));
  }

  @action async sort(column, direction) {
    let multiplier = (direction === 'asc') ? 1 : -1;
    return this.model.collection.sort((a, b) => multiplier * compare(get(a, column.valuePath), get(b, column.valuePath)))
  }
}
