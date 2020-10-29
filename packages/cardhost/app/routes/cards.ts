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
  title: string; // org name
  collectionId: string; // example: master-recordings, musical-works, etc.
  collectionTitle?: string; // collection display title. default is `humanized` version of collectionId
  logoURL?: string; // org logo URL
  brandColor?: string; // org color to be used as header background and behind the org logo. default is black.
  realm?: string; // this will become mandatory once we add a realm for each org
}

// TODO: These are the sample user's orgs. Each org will have its own realm. Move all this data elsewhere.
const ORGS = [
  {
    id: 'bunny-records',
    title: 'Bunny Records',
    logoURL: '/assets/images/orgs/bunny-logo.svg',
    brandColor: '#FF1D6C',
    collectionId: 'master-recordings',
    collectionTitle: 'Master Recordings',
    realm: 'https://builder-hub.stack.cards/api/realms/verifi',
  },
  {
    id: 'crd-records',
    title: 'CRD Records',
    logoURL: '/assets/images/orgs/crd-logo.svg',
    brandColor: '#0069F9',
    collectionId: 'master-recordings',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'warner-music-group',
    title: 'Warner Music Group',
    logoURL: '/assets/images/orgs/wmg-logo.svg',
    brandColor: '#0061aa',
    collectionId: 'master-recordings',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'warner-chappell-music',
    title: 'Warner Chappell Music',
    logoURL: '/assets/images/orgs/wcm-logo.png',
    collectionId: 'musical-works',
    collectionTitle: 'Musical Works',
  },
  {
    id: 'global-music-rights',
    title: 'Global Music Rights',
    logoURL: '/assets/images/orgs/gmr-logo.svg',
    collectionId: 'master-recordings',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'deezer',
    title: 'Deezer',
    logoURL: '/assets/images/orgs/deezer-logo.png',
    collectionId: 'musical-works',
    collectionTitle: 'Musical Works',
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
