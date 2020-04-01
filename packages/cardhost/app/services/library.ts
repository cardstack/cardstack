import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import { getUserRealm } from '../utils/scaffolding';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
import DataService from './data';
import { AddressableCard } from '@cardstack/hub';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { deviceCardsOnly } = ENV;

const catalogEntry = Object.freeze({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const cardCatalogRealm = 'https://cardstack.com/api/realms/card-catalog';
// TODO need to think through pagination on the library page...
const size = 100;

export default class LibraryService extends Service {
  @service data!: DataService;
  @service cardLocalStorage: any;

  @tracked visible = false;
  @tracked recentCards: AddressableCard[] = [];
  @tracked templateEntries: AddressableCard[] = [];
  @tracked featuredEntries: AddressableCard[] = [];

  constructor(...args: any[]) {
    super(...args);

    this.load.perform();
  }

  @task(function*(this: LibraryService) {
    if (deviceCardsOnly) {
      // only show recent cards from this device, as identified by a string in local storage
      return yield this.data.search(
        {
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
            eq: {
              csCreatedBy: this.cardLocalStorage.getDevice(),
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    } else {
      return yield this.data.search(
        {
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
            eq: {
              csRealm: getUserRealm(),
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    }
  })
  loadUserRealm: any; //TS and EC don't play nice;

  @task(function*(this: LibraryService) {
    let [recentCards, templateEntries, featuredEntries] = yield Promise.all([
      this.loadUserRealm.perform(),
      this.data.search(
        {
          filter: {
            type: catalogEntry,
            eq: {
              csRealm: cardCatalogRealm,
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
    this.recentCards = recentCards;
    this.templateEntries = templateEntries;
    this.featuredEntries = featuredEntries;
  })
  load: any; // TS and EC don't play nice

  @action
  show() {
    this.visible = true;
  }

  @action
  hide() {
    this.visible = false;
  }
}
