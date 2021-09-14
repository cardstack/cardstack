import Route from '@ember/routing/route';
import '../css/pay.css';
import { inject as service } from '@ember/service';
import SafeViewer from '@cardstack/web-client/services/safe-viewer';
import * as Sentry from '@sentry/browser';
import { MerchantSafe } from '@cardstack/cardpay-sdk';

interface PayRouteModel {
  network: string;
  merchantSafe: MerchantSafe;
}

export default class PayRoute extends Route {
  @service('safe-viewer') declare safeViewer: SafeViewer;

  async model(params: {
    network: string;
    merchant_safe_id: string;
  }): Promise<PayRouteModel> {
    try {
      return {
        network: params.network,
        merchantSafe: await this.fetchMerchantSafe(
          params.network,
          params.merchant_safe_id
        ),
      };
    } catch (e) {
      Sentry.captureException(e);
      throw e;
    }
  }

  async fetchMerchantSafe(network: string, address: string) {
    if (network !== 'xdai' && network !== 'sokol') {
      throw new Error(
        `Failed to fetch information about merchant, network was unrecognized: ${network}`
      );
    }

    let data = await this.safeViewer.view(network, address);

    if (!data || data.type !== 'merchant')
      throw new Error(
        'Failed to fetch information about merchant, could not find a corresponding merchant safe'
      );

    return data;
  }
}
