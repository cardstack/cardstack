import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';

export default class IsolatedCollection extends Component {
  queryParams = ['version'];

  @tracked version = null;
  @tracked format = this.args.format || 'grid';
  @tracked collection;
  @tracked tableCols = this.args?.field?.columns || this.args?.model?.columns;
  @tracked sortColumn = this.sortColumns ? this.sortColumns[0] : null;
  @tracked sortDirection = 'asc';

  constructor(...args) {
    super(...args);

    let version = this.version;
    let collection = this.args.model ? this.args.model.collection : [];

    if (version) {
      this.collection.filter((el) => el.version === version);
    }

    this.collection = collection.filter((el) => !el.version);

    if (this.args.model && this.args.model.length) {
      this.updateSelectionCount();
    }
  }

  get sortColumns() {
    return this.tableCols
      ? this.tableCols.filter((c) => c.isSortable !== false && c.name)
      : [];
  }

  @action
  updateCollections() {
    let version = this.version;
    let collection = this.args.model ? this.args.model.collection : [];

    if (version) {
      this.collection.filter((el) => el.version === version);
    }

    this.collection = collection.filter((el) => !el.version);
    this.updateSelectionCount();
  }

  @action
  updateSelectionCount() {
    set(
      this.collection,
      'selectedItemCount',
      this.collection.filter((item) => item.selected).length
    );
    set(
      this.collection,
      'selectedAll',
      this.collection.length === this.collection.selectedItemCount
    );
  }

  @action
  changeFormat(val) {
    if (this.args.changeFormat) {
      this.args.changeFormat(val);
    }
    this.format = val;
    if (this.args.model && this.args.model.length) {
      this.updateSelectionCount();
    }
  }

  // @action
  // togglePin(item) {
  //   set(item, 'pinned', !item.pinned);
  // }

  @action
  toggleSelectAll() {
    if (this.collection.selectedItemCount) {
      set(this.collection, 'selectedAll', false);
    } else {
      set(this.collection, 'selectedAll', !this.collection.selectedAll);
    }

    for (let item of this.collection) {
      if (this.collection.selectedAll) {
        set(item, 'selected', true);
      } else {
        set(item, 'selected', false);
      }
    }
    set(
      this.collection,
      'selectedItemCount',
      this.collection.filter((item) => item.selected).length
    );
  }

  @action
  toggleSelect(item) {
    set(item, 'selected', !item.selected);
    this.updateSelectionCount();
  }

  @action
  async sort(column, direction = null) {
    if (direction) {
      this.sortDirection = direction;
    } else if (column == this.sortColumn) {
      this.sortDirection = { asc: 'desc', desc: 'asc' }[this.sortDirection];
    } else {
      this.sortDirection = 'asc';
    }
    this.sortColumn = column;

    this.collection = (
      await this.args.sort(this.sortColumn, this.sortDirection)
    ).slice();

    this.updateSelectionCount();
  }

  @action async search(event) {
    this.collection = (await this.args.search(event.target.value)).slice();
    this.updateSelectionCount();
  }

  @action async tableSort(sorts) {
    let column = this.tableCols.find((c) => c.valuePath === sorts[0].valuePath);
    await this.sort(column);
  }

  @action async removeItem(item) {
    this.collection = (await this.args.removeItem(item)).slice();
    this.updateSelectionCount();
  }
}
