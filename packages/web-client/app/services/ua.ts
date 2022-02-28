import Service from '@ember/service';
import UAParser from 'ua-parser-js';

// see https://github.com/duskload/react-device-detect/blob/5d2907feeb5a010bb853bf1b884311fcf18d9883/main.js#L568
function isIPad13() {
  return (
    window.navigator &&
    window.navigator.platform &&
    (window.navigator.platform.indexOf('iPad') !== -1 ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1 &&
        !(window as any).MSStream))
  );
}

export default class UA extends Service {
  uaParser = new UAParser();

  isIOS() {
    return this.uaParser.getOS().name === 'iOS' || isIPad13();
  }

  isAndroid() {
    return this.uaParser.getOS().name === 'Android';
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    ua: UA;
  }
}
