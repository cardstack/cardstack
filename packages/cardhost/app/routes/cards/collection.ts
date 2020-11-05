import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import { singularize } from 'ember-inflector';
import { dasherize } from '@ember/string';
import DataService from '../../services/data';
import CardLocalStorageService from '../../services/card-local-storage';
import { getUserRealm } from '../../utils/scaffolding';
import { AddressableCard, CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
import { Org } from '../../services/cardstack-session';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment, hubURL } = ENV;
const size = 100;

interface Model {
  id: string;
  cards: AddressableCard[];
  org: Org;
}

interface OrgModel {
  org: Org;
}

export default class CollectionRoute extends Route {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;
  @tracked collectionEntries: AddressableCard[] = [];
  @tracked org!: Org;
  @tracked collectionId!: string;
  @tracked collectionType!: string;

  async model(args: any): Promise<Model> {
    let { collection } = args;

    let orgModel = this.modelFor('cards') as OrgModel;
    this.org = orgModel.org as Org;

    if (this.org.collections.includes(collection)) {
      this.collectionId = collection;
      // here, the collection id is the plural version of card type
      // reconsider this to enable making collections of different card types
      this.collectionType = singularize(this.collectionId);
    }

    if (this.org.realm) {
      await this.load.perform();
    } else {
      this.collectionEntries = [];
    }

    return {
      id: this.collectionId,
      cards: this.collectionEntries,
      org: this.org,
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
              csRealm: this.org.realm,
            },
          },
          sort: '-csCreated',
          page: { size },
        },
        { includeFieldSet: 'embedded' }
      );
    }

    let collectionCards: any = realmCards.filter((el: any) => {
      // using the formatted csTitle field for the card type
      if (el.csTitle) {
        return dasherize(el.csTitle.toLowerCase()) === this.collectionType;
      }
    });

    this.collectionEntries = collectionCards;
    return;
  })
  load: any; //TS and EC don't play nice;
}
