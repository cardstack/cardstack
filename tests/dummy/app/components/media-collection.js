import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';

export default class MediaCollectionComponent extends Component {
  @tracked collection = this.args.model.collection;
  @tracked format = this.args.format || 'grid';

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
}
