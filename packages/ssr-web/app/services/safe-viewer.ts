import Service from '@ember/service';
import { viewSafe } from '@cardstack/cardpay-sdk';

/**
 * Allows you to view a safe without being connected to web3
 */
export default class SafeViewer extends Service {
  view = viewSafe;
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'safe-viewer': SafeViewer;
  }
}
