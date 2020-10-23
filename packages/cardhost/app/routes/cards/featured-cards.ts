import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import LibraryService from '../../services/library';
import { AddressableCard } from '@cardstack/hub';

interface Model {
  featuredEntries: AddressableCard[];
}
export default class FeaturedCardsRoute extends Route {
  @service library!: LibraryService;

  async model(): Promise<Model> {
    await this.library.load.perform();
    return { featuredEntries: this.library.featuredEntries };
  }
}
