import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
import DataService from './data';
import CardLocalStorageService from './card-local-storage';
import { AddressableCard } from '@cardstack/hub';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;
const catalogEntry = Object.freeze({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const cardCatalogRealm = 'https://cardstack.com/api/realms/card-catalog';
// TODO need to think through pagination on the library page...
const size = 100;

export default class LibraryService extends Service {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;

  @tracked visible = false;
  @tracked templateEntries: AddressableCard[] = [];
  @tracked featuredEntries: AddressableCard[] = [];

  @task(function*(this: LibraryService) {
    let [templateEntries, featuredEntries] = yield Promise.all([
      // TODO: fix 'template' types in card-catalog and use it for fetching template cards
      this.data.search(
        {
          filter: {
            type: catalogEntry,
            eq: {
              csRealm: cardCatalogRealm,
              type: environment === 'test' ? 'template' : 'featured',
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
              csRealm: cardCatalogRealm,
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
    this.templateEntries = templateEntries;
    this.featuredEntries = featuredEntries;
  })
  load: any; // TS and EC don't play nice

  @action
  async show() {
    await this.load.perform();
    this.visible = true;
  }

  @action
  hide() {
    this.visible = false;
  }
}
