import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

// TODO: These are mock user's orgs. This data should reside somewhere else...
export const USER_ORGS = [
  {
    id: 'bunny-records',
    title: 'Bunny Records',
    logoURL: '/assets/images/orgs/bunny-logo.svg',
    brandColor: '#FF1D6C',
    collection: 'master-recording',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'crd-records',
    title: 'CRD Records',
    logoURL: '/assets/images/orgs/crd-logo.svg',
    brandColor: '#0069F9',
    collection: 'master-recording',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'warner-music-group',
    title: 'Warner Music Group',
    logoURL: '/assets/images/orgs/wmg-logo.svg',
    brandColor: '#0061aa',
    collection: 'master-recording',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'warner-chappell-music',
    title: 'Warner Chappell Music',
    logoURL: '/assets/images/orgs/wcm-logo.png',
    collection: 'musical-work',
    collectionTitle: 'Musical Works',
  },
  {
    id: 'global-music-rights',
    title: 'Global Music Rights',
    logoURL: '/assets/images/orgs/gmr-logo.svg',
    collection: 'master-recording',
    collectionTitle: 'Master Recordings',
  },
  {
    id: 'deezer',
    title: 'Deezer',
    logoURL: '/assets/images/orgs/deezer-logo.png',
    collection: 'musical-work',
    collectionTitle: 'Musical Works',
  },
];

export interface Org {
  id: string;
  title: string;
  collection: string; // example: 'master-recording', 'musical-work', etc
  logoURL?: string;
  brandColor?: string; // org color to be used as header background and behind the org logo. default is black.
}

export interface CardstackSession {
  isAuthenticated: boolean;
  username: string | undefined;
  userOrgs: Org[];
}

// This is just a mock until we have the real thing ready
export default class CardstackSessionService extends Service {
  @tracked isAuthenticated = true;
  @tracked username: string | undefined;
  @tracked userOrgs: Org[] = USER_ORGS;

  login(username: string) {
    this.isAuthenticated = true;
    this.username = username;
    this.userOrgs = USER_ORGS;
  }

  logout() {
    this.isAuthenticated = false;
    this.username = undefined;
    this.userOrgs = [];
  }
}
