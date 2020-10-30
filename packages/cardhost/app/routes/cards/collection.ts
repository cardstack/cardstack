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
import { Org } from '../../services/cardstack-session';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;
const size = 100;

interface Model {
  id: string;
  cards: AddressableCard[];
  currentOrg: Org;
}

interface OrgModel {
  currentOrg: Org;
}

export default class CollectionRoute extends Route {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;
  @tracked collectionEntries: AddressableCard[] = [];
  @tracked currentOrg!: Org;
  @tracked collectionId!: string;
  @tracked collectionType!: string;

  async model(): Promise<Model> {
    let orgModel = this.modelFor('cards') as OrgModel;
    this.currentOrg = orgModel.currentOrg as Org;
    this.collectionId = this.currentOrg.collectionId;
    this.collectionType = singularize(this.collectionId);

    if (this.currentOrg.realm) {
      await this.load.perform();
    } else {
      this.collectionEntries = [];
    }

    return {
      id: this.collectionId,
      cards: this.collectionEntries,
      currentOrg: this.currentOrg,
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
