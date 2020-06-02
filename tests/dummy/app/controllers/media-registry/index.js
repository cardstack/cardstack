import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { dasherize } from '@ember/string';
import { get } from '@ember/object';
import { compare } from '@ember/utils';

export default class MediaRegistryIndexController extends Controller {
  removed = [];

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
    let itemId = dasherize(item.catalog_title.trim());
    this.transitionToRoute('media-registry.collection', itemId);
  }

  @action
  async sort(column, direction) {
    let multiplier = (direction === 'asc') ? 1 : -1;
    return this.model.collection.sort((a, b) => multiplier * compare(get(a, column.valuePath), get(b, column.valuePath)))
  }

  @action
  transitionToPrevious() {
    this.transitionToRoute('media-registry');
  }

  @action
  removeItem(item) {
    this.removed.push(item);
    return this.model.collection.filter(i => !this.removed.includes(i));
  }
}
