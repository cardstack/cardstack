import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import config from '../config/environment';

export interface AppContextService {
  currentApp: 'card-space' | 'wallet';
  cardSpaceId: string;
}

export default class AppContext extends Service implements AppContextService {
  @service declare fastboot: Fastboot;

  get host() {
    let host = this.fastboot.isFastBoot
      ? this.fastboot.request.host
      : window.location.host;
    return host;
  }

  get currentApp(): 'card-space' | 'wallet' {
    return this.host.endsWith(config.cardSpaceHostnameSuffix)
      ? 'card-space'
      : 'wallet';
  }

  get cardSpaceId() {
    if (this.currentApp === 'card-space') {
      let id = this.host.replace(config.cardSpaceHostnameSuffix, '') ?? '';
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
