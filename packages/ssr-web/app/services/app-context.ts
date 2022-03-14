import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import config from '../config/environment';
import window from 'ember-window-mock';
export interface AppContextService {
  currentApp: 'card-space' | 'wallet';
  cardSpaceId: string;
  isCardSpace: boolean;
  isELBHealthChecker: boolean;
}

// escape dots for regexp
function escapeDot(str: string) {
  let result = '';
  for (let char of str) {
    if (char === '.') {
      result += '\\';
    }
    result += char;
  }
  return result;
}

export default class AppContext extends Service implements AppContextService {
  @service declare fastboot: Fastboot;
  // do not use the global or sticky flags on this or it will become stateful and
  // mess up tests
  hostSuffixPattern = new RegExp(
    escapeDot(config.cardSpaceHostnameSuffix) + '(:\\d+)?' + '$'
  );

  get host() {
    let host = this.fastboot.isFastBoot
      ? this.fastboot.request.host
      : window.location.host;
    return host;
  }

  get currentApp(): 'card-space' | 'wallet' {
    return this.hostSuffixPattern.test(this.host) ? 'card-space' : 'wallet';
  }

  get isCardSpace() {
    return this.currentApp === 'card-space';
  }

  get cardSpaceId() {
    if (this.isCardSpace) {
      let id = this.host.replace(this.hostSuffixPattern, '') ?? '';
      return id;
    } else return '';
  }

  get isELBHealthChecker() {
    if (this.fastboot.isFastBoot) {
      console.log('headers in fastboot', this.fastboot.request.headers);
      let userAgent = this.fastboot.request.headers.get('User-Agent') || '';
      console.log('user agent?', userAgent);
      let isELBHealthChecker = userAgent.includes('ELB-HealthChecker');
      console.log(`returning re health checker: ${isELBHealthChecker}`);

      return isELBHealthChecker;
    } else {
      return false;
    }
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'app-context': AppContextService;
  }
}
