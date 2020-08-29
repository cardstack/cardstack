import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, get } from '@ember/object';
import { compare, isBlank } from '@ember/utils';

export default class CardflowComponent extends Component {
  @tracked project = this.args.org?.user?.queueCards[0];
  @tracked actionSteps = this.args.actionSteps;
  @tracked lastUpdated = this.args.lastUpdated;
  @tracked isolatedCatalog = this.args.isolatedCatalog;
  @tracked catalogId = null;

  removed = [];

  @action
  setProgress(val) {
    this.args.updateProgress(val);
  }

  @action
  displayCatalog(id) {
    this.catalogId = id;
  }

  @action
  closeItem() {
    this.args.setItemId();
  }

  @action
  closeModal() {
    this.catalogId = null;
    this.closeItem();
  }

  @action
  async search(query) {
    let { collection, columns } = this.isolatedCatalog;
    if (isBlank(query)) {
      return collection;
    } else {
      let lowerQuery = query.toLowerCase();
      return collection.filter(i =>
        columns.some(c =>
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
    return this.isolatedCatalog.collection.sort((a, b) => multiplier * compare(get(a, column.valuePath), get(b, column.valuePath)))
  }

  @action
  removeItem(item) {
    this.removed.push(item);
    return this.isolatedCatalog.collection.filter(i => !this.removed.includes(i));
  }
}
