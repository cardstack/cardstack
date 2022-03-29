import Service from '@ember/service';
import { inject as service } from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import config from '../config/environment';
import window from 'ember-window-mock';
export interface AppContextService {
  currentApp: 'card-space' | 'wallet';
  cardSpaceId: string;
  isCardSpace: boolean;
}

const CARD_SPACE_SLUG_PARAMETER_NAME = 'slug';
const previewSubdomain = 'ssr-web-preview'; // FIXME extract somewhere? derive?

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

  get queryIsCardSpace() {
    if (!this.fastboot.isFastBoot) {
      return this.searchParams.has(CARD_SPACE_SLUG_PARAMETER_NAME);
    }

    return false;
  }

  get currentApp(): 'card-space' | 'wallet' {
    if (
      this.hostSuffixPattern.test(this.host) ||
      (this.host.includes(previewSubdomain) && this.queryIsCardSpace)
    ) {
      return 'card-space';
    } else {
      return 'wallet';
    }
  }

  get isCardSpace() {
    return this.currentApp === 'card-space';
  }

  get cardSpaceId() {
    if (this.isCardSpace) {
      if (this.queryIsCardSpace) {
        return this.searchParams.get(CARD_SPACE_SLUG_PARAMETER_NAME)!;
      } else {
        let id = this.host.replace(this.hostSuffixPattern, '') ?? '';
        return id;
      }
    } else return '';
  }

  get searchParams() {
    return new URLSearchParams(window.location.search);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'app-context': AppContextService;
  }
}
