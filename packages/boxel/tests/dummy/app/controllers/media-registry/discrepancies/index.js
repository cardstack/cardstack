import Controller from '@ember/controller';
import { action, get } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { compare, isBlank } from '@ember/utils';

export default class MediaRegistryDiscrepanciesIndexComponent extends Controller {
  queryParams = ['version'];
  @tracked version = null;

  removed = [];

  @action
  async search(query) {
    let collection = this.model.collection;
    if (isBlank(query)) {
      return collection;
    } else {
      let lowerQuery = query.toLowerCase();
      return collection.filter((i) =>
        this.model.columns.some(
          (c) =>
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
    let multiplier = direction === 'asc' ? 1 : -1;
    return this.model.collection.sort(
      (a, b) =>
        multiplier * compare(get(a, column.valuePath), get(b, column.valuePath))
    );
  }

  @action
  removeItem(item) {
    this.removed.push(item);
    return this.model.collection.filter((i) => !this.removed.includes(i));
  }

  @action
  expandAction(item) {
    this.transitionToRoute('media-registry.discrepancies.discrepancy', item.id);
  }
}
