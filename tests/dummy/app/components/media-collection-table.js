import Component from '@glimmer/component';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';

export default class MediaCollectionTableComponent extends Component {
  @service router;


  @action
  toggleSelect(item) {
    let collection = this.args.collection;
    set(item, 'selected', !item.selected);
    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
    set(collection, 'selectedAll', collection.length === collection.selectedItemCount);
  }

  @action
  selectOrTransition(item) {
    if (this.args.collection.selectedItemCount > 0) {
      this.toggleSelect(item);
    } else {
      this.args.transition(item);
    }
  }
}
