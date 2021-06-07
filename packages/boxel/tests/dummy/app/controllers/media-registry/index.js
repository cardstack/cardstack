import Controller from '@ember/controller';
import { action, get } from '@ember/object';
import { compare, isBlank } from '@ember/utils';
import { tracked } from '@glimmer/tracking';

export default class MediaRegistryIndexController extends Controller {
  queryParams = ['version'];
  removed = [];

  @tracked version = null;

  get collection() {
    let version = this.version;
    let collection = this.model.collection;

    if (version) {
      return collection.filter((el) => el.version === version);
    }

    return collection.filter((el) => !el.version);
  }

  @action
  transitionToIsolate(item) {
    if (this.model.type === 'master-collection') {
      return this.transitionToRoute('media-registry.collection', item.id);
    }

    if (this.version) {
      return this.transitionToRoute(
        'media-registry.version',
        item.id,
        this.version
      );
    }
    this.transitionToRoute('media-registry.item', item.id);
  }

  @action
  async search(query) {
    let collection = this.collection;
    if (isBlank(query)) {
      return collection;
    } else {
      let lowerQuery = query.toLowerCase();
      return collection.filter((i) =>
        this.model.columns.some(
          (c) =>
            c.isSearchable !== false &&
            c.valuePath &&
            !isBlank(i[c.valuePath]) &&
            String(i[c.valuePath]).toLowerCase().includes(lowerQuery)
        )
      );
    }
  }

  @action
  async sort(column, direction) {
    let multiplier = direction === 'asc' ? 1 : -1;
    return this.collection.sort(
      (a, b) =>
        multiplier * compare(get(a, column.valuePath), get(b, column.valuePath))
    );
  }

  @action
  removeItem(item) {
    this.removed.push(item);
    return this.collection.filter((i) => !this.removed.includes(i));
  }
}
