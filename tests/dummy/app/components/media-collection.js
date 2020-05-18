import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MediaCollectionComponent extends Component {
  @tracked format = this.args.format || 'grid';
  @service router;
  @tracked collection = this.args.model.collection;
  @tracked tableCols = this.args?.field?.columns || this.args?.model?.columns;
  @tracked sortColumn = this.sortColumns ? this.sortColumns[0] : null;
  @tracked sortDirection = 'asc';

  constructor(...args) {
    super(...args);
    let collection = this.collection;
    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
    set(collection, 'selectedAll', collection.length === collection.selectedItemCount);
  }

  @action
  changeFormat(val) {
    if (this.args.changeFormat) {
      this.args.changeFormat(val);
    }
    this.format = val;
  }

  @action
  toggleSelectAll() {
    let collection = this.collection;
    if (collection.selectedItemCount) {
      set(collection, 'selectedAll', false);
    } else {
      set(collection, 'selectedAll', !collection.selectedAll);
    }

    for (let item of collection) {
      if (collection.selectedAll) {
        set(item, "selected", true);
      } else {
        set(item, "selected", false);
      }
    }

    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
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
  }

  @action async tableSort(sorts) {
    let column = this.tableCols.find(c => c.valuePath === sorts[0].valuePath);
    await this.sort(column);
  }

  @action async removeItem(item) {
    this.collection = (await this.args.removeItem(item)).slice()
  }

}
