import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import DataService from '../../services/data';
import CardLocalStorageService from '../../services/card-local-storage';
import { AddressableCard } from '@cardstack/hub';
import { getUserRealm } from '../../utils/scaffolding';
import { Org, USER_ORGS } from '../../services/cardstack-session';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment, hubURL, devDir } = ENV;

const realmOrigin = 'https://builder-hub.stack.cards';
const size = 100;

interface RouteParams {
  collection: string;
}

export interface Model {
  id: string;
  cards: AddressableCard[];
  org: Org | undefined;
}

export default class CollectionRoute extends Route {
  @service data!: DataService;
  @service cardLocalStorage!: CardLocalStorageService;
  @tracked collectionEntries: AddressableCard[] = [];
  @tracked realmURL!: string;

  async model({ collection }: RouteParams): Promise<Model> {
    let currentOrg = USER_ORGS.find(el => el.id === collection);

    if (environment === 'test' || (!devDir && collection === 'default')) {
      this.realmURL = getUserRealm();
    } else if (devDir) {
      this.realmURL = `${hubURL}/api/realms/${collection}`;
    } else {
      this.realmURL = `${realmOrigin}/api/realms/${collection}`;
    }

    await this.load.perform();

    return {
      id: collection,
      cards: this.collectionEntries,
      org: currentOrg,
    };
  }

  @task(function*(this: CollectionRoute) {
    return (this.collectionEntries = yield this.data.search(
      {
        filter: {
          eq: {
            csRealm: this.realmURL,
          },
        },
        sort: '-csCreated',
        page: { size },
      },
      { includeFieldSet: 'embedded' }
    ));
  })
  load: any;
}
