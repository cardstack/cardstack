import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MediaCollectionComponent extends Component {
  @tracked format = this.args.format || 'grid';
  @service router;
  @tracked collection;
  @tracked tableCols = this.args?.field?.columns || this.args?.model?.columns;
  @tracked sortColumn = this.sortColumns ? this.sortColumns[0] : null;
  @tracked sortDirection = 'asc';

  constructor(...args) {
    super(...args);
    this.collection = this.args.model.collection;
    set(this.collection, 'selectedItemCount', this.collection.filter(item => item.selected).length);
    set(this.collection, 'selectedAll', this.collection.length === this.collection.selectedItemCount);
  }

  @action
  updateCollections() {
    this.collection = this.args.model.collection;
    set(this.collection, 'selectedItemCount', this.collection.filter(item => item.selected).length);
    set(this.collection, 'selectedAll', this.collection.length === this.collection.selectedItemCount);
  }

  @action
  changeFormat(val) {
    if (this.args.changeFormat) {
      this.args.changeFormat(val);
    }
    this.format = val;
    this.updateCollections();
  }

  @action
  toggleSelectAll() {
    if (this.collection.selectedItemCount) {
      set(this.collection, 'selectedAll', false);
    } else {
      set(this.collection, 'selectedAll', !this.collection.selectedAll);
    }

    for (let item of this.collection) {
      if (this.collection.selectedAll) {
        set(item, "selected", true);
      } else {
        set(item, "selected", false);
      }
    }
    set(this.collection, 'selectedItemCount', this.collection.filter(item => item.selected).length);
  }

  @action
  transitionToEdit() {
    if (this.args.model.type === 'collection') {
      this.router.transitionTo('media-registry.collection.edit', this.args.model.title);
    } else {
      this.router.transitionTo('media-registry.edit');
    }
  }

  @action
  transitionToView() {
    if (this.args.model.type === 'collection') {
      this.router.transitionTo('media-registry.collection', this.args.model.title);
    } else {
      this.router.transitionTo('media-registry');
    }
  }

  get sortColumns() {
    return this.tableCols.filter(c => c.isSortable !== false && c.name);
  }

  @action async sort(column, direction=null) {
    if (direction) {
      this.sortDirection = direction
    } else if (column == this.sortColumn) {
      this.sortDirection = { asc: 'desc', desc: 'asc' }[this.sortDirection];
    } else {
      this.sortDirection = 'asc';
    }
    this.sortColumn = column;

    this.collection = (await this.args.sort(this.sortColumn, this.sortDirection)).slice();

    if (this.format === 'table') {
      return set(this.collection, 'selectedItemCount', this.collection.filter(item => item.selected).length);
    }

    this.updateCollections();
  }

  @action async search(event) {
    this.collection = (await this.args.search(event.target.value)).slice();
  }

  @action async tableSort(sorts) {
    let column = this.tableCols.find(c => c.valuePath === sorts[0].valuePath);
    await this.sort(column);
  }

  @action async removeItem(item) {
    this.collection = (await this.args.removeItem(item)).slice();
  }
}
