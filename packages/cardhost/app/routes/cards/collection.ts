import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
//@ts-ignore
import { task } from 'ember-concurrency';
import DataService from '../../services/data';
import { AddressableCard } from '@cardstack/hub';

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

  @tracked collectionEntries: AddressableCard[] = [];

  async model(): Promise<Model> {
    await this.load.perform();

    return {
      title: collectionTitle,
      cards: this.collectionEntries,
    };
  }

  @task(function*(this: CollectionRoute) {
    let collectionEntries = yield this.data.search(
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

    this.collectionEntries = collectionEntries;
  })
  load: any; //TS and EC don't play nice;
}
