import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import { singularize } from 'ember-inflector';
import DataService from '../../services/data';
import CardLocalStorageService from '../../services/card-local-storage';
import { getUserRealm } from '../../utils/scaffolding';
import { AddressableCard, CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';
import { Org } from '../cards';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;
const size = 100;

interface Model {
  org: Org;
  title: string;
  cards: AddressableCard[];
}

interface OrgModel {
  org: Org;
}

export default class CollectionRoute extends Route {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;
  @tracked collectionEntries: AddressableCard[] = [];
  @tracked currentOrg!: Org;
  @tracked collectionType!: string;

  async model(args: any): Promise<Model> {
    let { collection } = args;
    this.collectionType = singularize(collection);

    let orgModel = this.modelFor('cards') as OrgModel;
    this.currentOrg = orgModel.org as Org;

    // TODO: Dynamically fetch data for org
    if (this.currentOrg.realm) {
      await this.load.perform();
    } else {
      this.collectionEntries = [];
    }

    return {
      org: this.currentOrg,
      title: collection,
      cards: this.collectionEntries,
    };
  }

  @task(function*(this: CollectionRoute) {
    let collectionEntries;

    if (environment === 'development' || environment === 'test') {
      collectionEntries = yield this.data.search(
        {
          filter: {
            type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' },
            eq: {
              csRealm: getUserRealm(),
              csTitle: this.collectionType,
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
              csRealm: this.currentOrg.realm || null,
              csTitle: this.collectionType,
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
