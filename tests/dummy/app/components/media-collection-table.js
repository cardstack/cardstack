import Component from '@glimmer/component';
import { action, set } from '@ember/object';

export default class MediaCollectionTableComponent extends Component {
  @action
  toggleSelect(item) {
    let collection = this.args.collection;
    set(item, 'selected', !item.selected);
    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
    set(collection, 'selectedAll', collection.length === collection.selectedItemCount);
  }

  @action
  selectOrTransition(item) {
    this.args.transition(item);
  }
}
