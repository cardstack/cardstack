import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import LibraryService from '../../services/library';
import { AddressableCard } from '@cardstack/hub';

interface Model {
  cards: AddressableCard[];
}
export default class CollectionRoute extends Route {
  @service library!: LibraryService;

  async model(): Promise<Model> {
    await this.library.load.perform();

    // TODO: Load all cards of a certain type (ie. 'master-recording') without hardcoding
    let cards = this.library.recentCards.filter(
      card =>
        card.csId === 'master-recording' ||
        card.csId === 'a270403f2a98ebb392c4f7ef7002db40b9ec21c4' ||
        card.csId === 'e9a4b33bc854a559f3c1579e54bdc19ebab1603b'
    );
    return { cards };
  }
}
