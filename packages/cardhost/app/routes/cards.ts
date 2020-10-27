import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { set } from '@ember/object';
import RouteInfo from '@ember/routing/-private/route-info';
import Transition from '@ember/routing/-private/transition';
import LibraryService from '../services/library';

interface Model {
  orgs: Org[];
  org: Org;
  previousRoute?: RouteInfo;
}

export interface Org {
  id: string;
  title: string;
  logoURL: string;
  bgColor?: string;
  collection: string;
}

const ORGS = [
  {
    id: 'bunny-records',
    title: 'Bunny Records',
    logoURL: '/assets/images/orgs/bunny-logo.svg',
    bgColor: '#FF1D6C',
    collection: 'master-recordings',
  },
  {
    id: 'crd-records',
    title: 'CRD Records',
    logoURL: '/assets/images/orgs/crd-logo.svg',
    bgColor: '#0069F9',
    collection: 'master-recordings',
  },
  {
    id: 'warner-music-group',
    title: 'Warner Music Group',
    logoURL: '/assets/images/orgs/wmg-logo.svg',
    bgColor: '#0061aa',
    collection: 'master-recordings',
  },
  {
    id: 'warner-chappell-music',
    title: 'Warner Chappell Music',
    logoURL: '/assets/images/orgs/wcm-logo.png',
    collection: 'musical-works',
  },
  {
    id: 'global-music-rights',
    title: 'Global Music Rights',
    logoURL: '/assets/images/orgs/gmr-logo.svg',
    collection: 'master-recordings',
  },
  {
    id: 'deezer',
    title: 'Deezer',
    logoURL: '/assets/images/orgs/deezer-logo.png',
    collection: 'musical-works',
  },
];

export default class CardsRoute extends Route {
  orgs: Org[] = ORGS;
  @service library!: LibraryService;
  @tracked currentOrg!: Org;

  async model(args: any): Promise<Model> {
    let { org } = args;
    this.currentOrg = this.orgs.find(el => el.id === org) || this.orgs[0];
    await this.library.load.perform();

    return {
      orgs: this.orgs,
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
