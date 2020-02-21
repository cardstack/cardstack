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

  async model(): Promise<{
    cards: AddressableCard[];
    templateEntries: AddressableCard[];
    featuredEntries: AddressableCard[];
  }> {
    let [cards, templateEntries, featuredEntries] = await Promise.all([
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
            eq: {
              type: 'template',
            },
          },
          // Note that we are sorting these items on the date the catalog entry
          // was created, not on the date that the underlying card was created
          // (which is simple to change if that's what we want).
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      ),
      this.data.search(
        {
          filter: {
            type: catalogEntry,
            eq: {
              type: 'featured',
            },
          },
          // Note that we are sorting these items on the date the catalog entry
          // was created, not on the date that the underlying card was created
          // (which is simple to change if that's what we want).
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'isolated' }
      ),
    ]);
    return { cards, templateEntries, featuredEntries };
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
