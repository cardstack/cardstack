import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { set } from '@ember/object';
import RouteInfo from '@ember/routing/-private/route-info';
import Transition from '@ember/routing/-private/transition';
import LibraryService from '../services/library';
import CardstackSessionService, { Org } from '../services/cardstack-session';

interface Model {
  previousRoute?: RouteInfo;
  currentOrg?: Org;
}

export default class CardsRoute extends Route {
  @service library!: LibraryService;
  @service cardstackSession!: CardstackSessionService;
  @tracked currentOrg!: Org | undefined;

  async model(args: any): Promise<Model> {
    let { org } = args;
    let userOrgs = this.cardstackSession.userOrgs;

    if (userOrgs.length) {
      this.currentOrg = userOrgs.find(el => el.id === org) || userOrgs[0];
    }

    await this.library.load.perform();

    return {
      currentOrg: this.currentOrg,
    };
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
