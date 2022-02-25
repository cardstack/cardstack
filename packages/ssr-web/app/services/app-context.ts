import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';

export interface AppContextService {
  currentApp: 'card-space' | 'wallet';
  cardSpaceId: string;
}

export default class AppContext extends Service implements AppContextService {
  @service declare fastboot: Fastboot;

  get currentApp(): 'card-space' | 'wallet' {
    // return 'wallet';
    return 'card-space';
  }

  get cardSpaceId() {
    return 'nosuchmerchant';
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'app-context': AppContextService;
  }
}
