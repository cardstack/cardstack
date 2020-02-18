import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { AddressableCard } from '@cardstack/core/card';
import { action } from '@ember/object';
import DataService from '../services/data';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const catalogEntry = Object.freeze({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
// TODO need to think through pagination on the catalog page...
const size = 100;

export default class IndexRoute extends Route {
  @service data!: DataService;

  async model(): Promise<{ cards: AddressableCard[]; catalogEntries: AddressableCard[] }> {
    let [cards, catalogEntries] = await Promise.all([
      this.data.search(
        // TODO we really want this filter to not include catalog-entry cards. I
        // think we'll need to introduce a new type of filter to be able to
        // filter out just a specific type of card from the result set.
        {
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      ),
      this.data.search(
        {
          filter: {
            type: catalogEntry,
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      ),
    ]);
    return { cards, catalogEntries };
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
