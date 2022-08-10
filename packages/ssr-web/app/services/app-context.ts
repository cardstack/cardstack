import Service from '@ember/service';
import { inject as service } from '@ember/service';
import ProfileService from '@cardstack/ssr-web/services/profile';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import config from '../config/environment';
import window from 'ember-window-mock';
export interface AppContextService {
  currentApp: 'profile' | 'wallet';
  profileId: string;
}

const CARD_SPACE_SLUG_PARAMETER_NAME = 'slug';

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
  @service('profile') declare profile: ProfileService;
  @service declare fastboot: Fastboot;
  // do not use the global or sticky flags on this or it will become stateful and
  // mess up tests
  hostSuffixPattern = new RegExp(
    escapeDot(config.profileHostnameSuffix) + '(:\\d+)?' + '$'
  );

  get host() {
    let host = this.fastboot.isFastBoot
      ? this.fastboot.request.host
      : window.location.host;
    return host;
  }

  get hostIsPreview() {
    return this.host.includes(config.previewSubdomainInfix);
  }

  get queryIsCardSpace() {
    if (!this.fastboot.isFastBoot) {
      return this.searchParams.has(CARD_SPACE_SLUG_PARAMETER_NAME);
    }

    return false;
  }

  get currentApp(): 'profile' | 'wallet' {
    if (
      this.hostSuffixPattern.test(this.host) ||
      (this.hostIsPreview && this.queryIsCardSpace)
    ) {
      return 'profile';
    } else {
      return 'wallet';
    }
  }

  get profileId() {
    if (this.profile.isActive) {
      if (this.queryIsCardSpace) {
        return this.searchParams.get(CARD_SPACE_SLUG_PARAMETER_NAME)!;
      } else {
        let id = this.host.replace(this.hostSuffixPattern, '') ?? '';
        return id;
      }
    } else return '';
  }

  get searchParams() {
    return new URLSearchParams(
      this.fastboot.isFastBoot
        ? this.fastboot.request.queryParams
        : window.location.search
    );
  }

  getAbsolutePath(relativePath: string) {
    let pathWithLeadingSlash = relativePath.startsWith('/')
      ? relativePath
      : `/${relativePath}`;
    return `https://${config.universalLinkDomain}${pathWithLeadingSlash}`;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'app-context': AppContextService;
  }
}
