import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { set } from '@ember/object';
import RouteInfo from '@ember/routing/-private/route-info';
import Transition from '@ember/routing/-private/transition';
import LibraryService from '../services/library';

interface Model {
  org: Org;
  previousRoute?: RouteInfo;
}

export interface Org {
  id: string;
  title: string;
  logoURL: string;
  bgColor?: string;
}

export default class CardsRoute extends Route {
  @service library!: LibraryService;
  @tracked currentOrg!: Org;

  async model(args: any): Promise<Model> {
    let { org } = args;
    switch (org) {
      // Note: These are the user's orgs
      case 'crd-records':
        this.currentOrg = {
          id: org,
          title: 'CRD Records',
          logoURL: '/assets/images/orgs/crd-logo.svg',
          bgColor: '#0069F9',
        };
        break;

      default:
        this.currentOrg = {
          id: 'bunny-records',
          title: 'Bunny Records',
          logoURL: '/assets/images/orgs/bunny-logo.svg',
          bgColor: '#FF1D6C',
        };
    }
    await this.library.load.perform();

    return {
      org: this.currentOrg,
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
