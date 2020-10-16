import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import DataService from '../../services/data';
import CardLocalStorageService from '../../services/card-local-storage';
import { getUserRealm } from '../../utils/scaffolding';
import { AddressableCard, CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;

const verifiRealm = 'https://builder-hub.stack.cards/api/realms/verifi';
const size = 100;
const collectionType = 'Master Recording';
const collectionTitle = 'Master Recordings';

interface Model {
  title: string;
  cards: AddressableCard[];
}
export default class CollectionRoute extends Route {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;

  @tracked collectionEntries: AddressableCard[] = [];

  async model(): Promise<Model> {
    await this.load.perform();

    return {
      title: collectionTitle,
      cards: this.collectionEntries,
    };
  }

  @task(function*(this: CollectionRoute) {
    let collectionEntries;

    if (environment === 'development') {
      collectionEntries = yield this.data.search(
        {
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
            eq: {
              csRealm: getUserRealm(),
              csTitle: collectionType,
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    } else {
      collectionEntries = yield this.data.search(
        {
          filter: {
            eq: {
              csRealm: verifiRealm,
              csTitle: collectionType,
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    }

    this.collectionEntries = collectionEntries;
    return;
  })
  load: any; //TS and EC don't play nice;
}
