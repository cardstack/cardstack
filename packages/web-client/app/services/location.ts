import Service from '@ember/service';

export interface LocationService {
  hostname: string;
}

/**
 * A seam to mock window.location for testing
 */
export default class Location extends Service implements LocationService {
  get hostname() {
    return window.location.hostname;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    location: Location;
  }
}
