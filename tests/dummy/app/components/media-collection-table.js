import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { dasherize } from '@ember/string';
import { inject as service } from '@ember/service';

export default class MediaCollectionTableComponent extends Component {
  @service router;
  @tracked collection = this.args.collection;

  @action
  toggleSelect(item) {
    let collection = this.collection;
    set(item, 'selected', !item.selected);
    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
    set(collection, 'selectedAll', collection.length === collection.selectedItemCount);
  }

  @action
  selectOrTransition(item) {
    if (this.collection.selectedItemCount > 0) {
      this.toggleSelect(item);
    } else {
      if (this.args.type === 'collection') {
        let itemId = dasherize(item.song_title.trim());
        this.router.transitionTo('media-registry.item', itemId);
      } else {
        let itemId = dasherize(item.catalog_title.trim());
        this.router.transitionTo('media-registry.collection', itemId);
      }
    }
  }

  @action
  removeItem(item) {
    if (this.args.type === 'collection') {
      this.collection = this.collection.filter(li => li.song_title !== item.song_title);
    } else {
      this.collection = this.collection.filter(li => li.catalog_title !== item.catalog_title);
    }
  }
}
