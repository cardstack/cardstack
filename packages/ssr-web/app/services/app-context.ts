import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';

export interface AppContextService {
  currentApp: 'card-space' | 'wallet';
  cardSpaceId: string;
}

// TODO: string manipulation with knowledge of card space suffixes from config
export default class AppContext extends Service implements AppContextService {
  @service declare fastboot: Fastboot;

  get host() {
    let host = this.fastboot.isFastBoot
      ? this.fastboot.request.host
      : window.location.host;
    return host;
  }

  get currentApp(): 'card-space' | 'wallet' {
    return this.host.endsWith('card.space.localhost:4210')
      ? 'card-space'
      : 'wallet';
  }

  get cardSpaceId() {
    if (this.currentApp === 'card-space') {
      let id = this.host.split('.')[0] ?? '';
      return id;
    } else return '';
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'app-context': AppContextService;
  }
}
