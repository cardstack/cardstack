import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { set } from '@ember/object';
import RouteInfo from '@ember/routing/-private/route-info';
import Transition from '@ember/routing/-private/transition';
import LibraryService from '../services/library';
import CardstackSessionService from '../services/cardstack-session';

interface Model {
  previousRoute?: RouteInfo;
}

export default class CardsRoute extends Route {
  @service library!: LibraryService;
  @service cardstackSession!: CardstackSessionService;

  async model(): Promise<Model> {
    return {};
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
