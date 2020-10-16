import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { set } from '@ember/object';
import RouteInfo from '@ember/routing/-private/route-info';
import Transition from '@ember/routing/-private/transition';
import LibraryService from '../services/library';
import { AddressableCard } from '@cardstack/hub';

interface Model {
  featuredEntries: AddressableCard[];
  previousRoute?: RouteInfo;
}
export default class CardsRoute extends Route {
  @service library!: LibraryService;

  async model(): Promise<Model> {
    await this.library.load.perform();
    return { featuredEntries: this.library.featuredEntries };
  }

  @action
  willTransition(transition: Transition) {
    this.library.hide();
    let model = this.modelFor(this.routeName) as Model;
    if (model) {
      set(model, 'previousRoute', transition?.from || undefined);
    }
  }
}
