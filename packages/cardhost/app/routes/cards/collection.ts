import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import LibraryService from '../../services/library';
import { AddressableCard } from '@cardstack/hub';

interface Model {
  title: string;
  cards: AddressableCard[];
}
export default class CollectionRoute extends Route {
  @service library!: LibraryService;

  async model(): Promise<Model> {
    await this.library.load.perform();

    // TODO: Load all cards of a given type (ie. 'master-recording')
    let cards = this.library.collectionEntries;

    return {
      title: 'Master Recordings', // TODO: Need to fetch collection title here
      cards,
    };
  }
}
