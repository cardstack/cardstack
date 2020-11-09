import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import { dasherize } from '@ember/string';
import DataService from '../../services/data';
import CardLocalStorageService from '../../services/card-local-storage';
import { getUserRealm } from '../../utils/scaffolding';
import { AddressableCard, CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
import { Org, USER_ORGS } from '../../services/cardstack-session';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment, hubURL } = ENV;
const size = 100;

interface RouteParams {
  collection: string;
}

interface Model {
  id: string;
  cards: AddressableCard[];
  org: Org | undefined;
}

const realmsRoot = 'https://builder-hub.stack.cards/api/realms';

export default class CollectionRoute extends Route {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;
  @tracked collectionEntries: AddressableCard[] = [];
  @tracked realmId!: string;
  @tracked collectionId!: string;

  async model({ collection }: RouteParams): Promise<Model> {
    let currentOrg = USER_ORGS.find(el => el.id === collection);
    this.realmId = `${realmsRoot}/${collection}`;

    if (currentOrg) {
      this.collectionId = currentOrg.collection;
      await this.load.perform();
    } else {
      this.collectionEntries = [];
    }

    return {
      id: this.collectionId,
      cards: this.collectionEntries,
      org: currentOrg,
    };
  }

  @task(function*(this: CollectionRoute) {
    let realmCards;

    if (hubURL === 'http://localhost:3000' || environment === 'test') {
      realmCards = yield this.data.search(
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
    } else {
      realmCards = yield this.data.search(
        {
          filter: {
            eq: {
              csRealm: this.realmId,
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    }

    let collectionCards: any = realmCards.filter((el: any) => {
      // using the formatted csTitle field for the collection card type
      // TODO: better way to filter out collection cards
      if (el.csTitle) {
        return dasherize(el.csTitle.toLowerCase()) === this.collectionId;
      }
    });

    this.collectionEntries = collectionCards;
    return;
  })
  load: any; //TS and EC don't play nice;
}
