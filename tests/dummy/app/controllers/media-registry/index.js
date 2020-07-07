import Controller from '@ember/controller';
import { action, get } from '@ember/object';
import { dasherize } from '@ember/string';
import { compare, isBlank } from '@ember/utils';

export default class MediaRegistryIndexController extends Controller {
  removed = [];

  @action
  transitionToIsolate(item) {
    let itemId = dasherize(item.catalog_title.trim());
    this.transitionToRoute('media-registry.collection', itemId);
  }

  @action
  transitionToEdit() {
    this.transitionToRoute('media-registry.edit');
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry');
  }

  @action
  async search(query) {
    let collection = this.model.collection;
    if (isBlank(query)) {
      return collection;
    } else {
      let lowerQuery = query.toLowerCase();
      return collection.filter(i =>
        this.model.columns.some(c =>
            c.isSearchable !== false &&
            c.valuePath &&
            !isBlank(i[c.valuePath]) &&
            String(i[c.valuePath]).toLowerCase().includes(lowerQuery)
        )
      );
    }
  }

  @action
  async sort(column, direction) {
    let multiplier = (direction === 'asc') ? 1 : -1;
    return this.model.collection.sort((a, b) => multiplier * compare(get(a, column.valuePath), get(b, column.valuePath)))
  }

  @action
  removeItem(item) {
    this.removed.push(item);
    return this.model.collection.filter(i => !this.removed.includes(i));
  }
}
