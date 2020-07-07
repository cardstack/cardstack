import Component from '@glimmer/component';
import { action, set } from '@ember/object';

export default class IsolatedCollectionTableComponent extends Component {
  titleCaseFields = ["song_title", "album", "catalog_title"];
  dateFields = ["date_created", "date_updated"];

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
