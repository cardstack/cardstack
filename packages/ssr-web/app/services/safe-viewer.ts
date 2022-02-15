import Service from '@ember/service';
import { Layer2NetworkSymbol } from '../utils/web3-strategies/types';
import { viewSafe } from '@cardstack/cardpay-sdk';
import { ViewSafeResult } from '@cardstack/cardpay-sdk';

/**
 * Allows you to view a safe without being connected to web3
 */
export default class SafeViewer extends Service {
  async view(
    network: Layer2NetworkSymbol,
    address: string
  ): Promise<ViewSafeResult> {
    return viewSafe(network, address);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'safe-viewer': SafeViewer;
  }
}
