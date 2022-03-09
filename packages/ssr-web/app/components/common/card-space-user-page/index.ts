import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import config from '@cardstack/ssr-web/config/environment';
import { generateMerchantPaymentUrl } from '@cardstack/cardpay-sdk';
import { action } from '@ember/object';
import { PaymentLinkMode } from '../payment-link';
import { inject as service } from '@ember/service';
import UA from '@cardstack/ssr-web/services/ua';
import Subgraph from '@cardstack/ssr-web/services/subgraph';
import * as Sentry from '@sentry/browser';

interface CardSpaceUserPageArgs {
  model: {
    did: string;
    id: string;
    name: string;
    backgroundColor: string;
    textColor: string;
  };
}

export default class CardSpaceUserPage extends Component<CardSpaceUserPageArgs> {
  @service('ua') declare UAService: UA;
  @tracked paymentLinkMode: PaymentLinkMode = 'link';
  @tracked address: string | null = null;
  @tracked addressFetchingError: string | null = null;
  @service declare subgraph: Subgraph;
  defaultAddressFetchingErrorMsg =
    'We ran into an issue while generating the payment request link. Please reload the page and try again. If the issue persists, please contact support.';

  @action setInitialPaymentLinkMode() {
    if (!this.canDeepLink) {
      this.paymentLinkMode = 'qr-non-mobile';
    }
  }

  @action setPaymentLinkMode(mode: PaymentLinkMode) {
    this.paymentLinkMode = mode;
  }

  get canDeepLink() {
    return this.UAService.isIOS() || this.UAService.isAndroid();
  }

  @action async loadAddress() {
    this.addressFetchingError = null;

    let address;
    let did = this.args.model.did;

    try {
      let queryResult = await this.subgraph.query(
        config.chains.layer2,
        `query($did: String!) {
            merchantSafes(where: { infoDid: $did }) {
              id
            }
          }`,
        {
          did,
        }
      );

      address = queryResult?.data?.merchantSafes[0]?.id;
    } catch (e) {
      this.addressFetchingError = this.defaultAddressFetchingErrorMsg;
      Sentry.captureException(e);
    }

    if (address) {
      this.address = address;
    } else {
      this.addressFetchingError = this.defaultAddressFetchingErrorMsg;
      Sentry.captureException(`Unable to find merchant address for ${did}`);
    }
  }

  get paymentURL() {
    if (!this.address) return null;

    return generateMerchantPaymentUrl({
      domain: config.universalLinkDomain,
      merchantSafeID: this.address as string,
      network: config.chains.layer2,
    });
  }

  get deepLinkPaymentURL() {
    if (!this.address) return null;

    return generateMerchantPaymentUrl({
      merchantSafeID: this.address as string,
      network: config.chains.layer2,
    });
  }
}
