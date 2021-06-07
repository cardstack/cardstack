import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';

export default class EmbeddedCollectionEditor extends Component {
  @tracked collection = this.args.collection;
  @tracked field = this.args.field;
  @tracked displayCount = 2;
  @tracked expanded = false;
  @tracked format = this.args.format || 'list';

  @action addItem(item) {
    this.collection = [...this.collection, item];
    if (this.expanded) {
      this.displayCount = this.collection.length;
    }
    set(
      this.collection,
      'selectedItemCount',
      this.collection.filter((item) => item.selected).length
    );
  }

  @action addBelongsToItem(item) {
    set(this.field, 'value', item);
  }

  @action removeBelongsToItem() {
    set(this.field, 'value', null);
  }

  @action removeItem(item) {
    this.collection = this.collection.filter((el) => el.id !== item.id);
    set(
      this.collection,
      'selectedItemCount',
      this.collection.filter((item) => item.selected).length
    );
  }

  @action
  toggleSelect(item) {
    set(item, 'selected', !item.selected);
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
  viewAll() {
    this.displayCount = this.collection.length;
    this.expanded = true;
  }

  @action
  collapse() {
    this.displayCount = 2;
    this.expanded = false;
  }
}
