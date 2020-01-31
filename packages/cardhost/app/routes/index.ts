import Route from '@ember/routing/route';
import { AddressableCard } from '@cardstack/core/card';
import { action } from '@ember/object';

export default class IndexRoute extends Route {
  async model(): Promise<{ catalog: AddressableCard[]; templates: AddressableCard[] }> {
    // TODO use the data service to search for templates and the catalog--which
    // currently represents all the cards in the index (but in the future more
    // likely represents all the cards that originate from a particular realm).
    return {
      catalog: [],
      templates: [],
    };
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
