import Controller from '@ember/controller';
import { action, set } from '@ember/object';
import { dasherize } from '@ember/string';
import { get } from '@ember/object';
import { compare, isBlank } from '@ember/utils';
import { inject as service } from '@ember/service';


export default class MediaRegistryCollectionController extends Controller {
  @service router;
  @action
  toggleSelect(item) {
    let collection = this.model.collection;
    set(item, 'selected', !item.selected);
    set(collection, 'selectedItemCount', collection.filter(item => item.selected).length);
    set(collection, 'selectedAll', collection.length === collection.selectedItemCount);
  }

  @action
  selectOrTransition(item) {
    if (this.model.collection.selectedItemCount > 0) {
      this.toggleSelect(item);
    } else {
      let itemId = dasherize(item.song_title.trim());
      this.transitionToRoute('media-registry.item', itemId);
    }
  }


  @action async sort(column, direction) {
    let multiplier = (direction === 'asc') ? 1 : -1;
    return this.model.collection.sort((a, b) => multiplier * compare(get(a, column.valuePath), get(b, column.valuePath)))
  }

  @action async search(query) {
    let collection = this.model.collection;
    if (isBlank(query)) {
      return collection;
    } else {
      let lowerQuery = query.toLowerCase();
      return collection.filter(i =>
        this.model.columns.some(c =>
           c.isSearchable !== false &&
           c.valuePath &&
           !isBlank(i[c.valuePath]) &&
           i[c.valuePath].toLowerCase().includes(lowerQuery)
        )
      );
    }
  }

  @action transition(item) {
    let itemId = dasherize(item.song_title.trim());
    this.router.transitionTo('media-registry.item', itemId);
  }
}
