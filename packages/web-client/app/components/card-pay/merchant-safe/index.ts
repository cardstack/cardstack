import Component from '@glimmer/component';
import { MerchantCustomization } from '@cardstack/web-client/resources/merchant-customization';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import { useResource } from 'ember-resources';

interface CardPayMerchantSafeComponentArgs {
  safe: MerchantSafe;
  waitForCustomization?: boolean;
}

export default class CardPayMerchantSafeComponent extends Component<CardPayMerchantSafeComponentArgs> {
  customization = useResource(this, MerchantCustomization, () => ({
    infoDID: this.args.safe.infoDID,
    waitForCustomization: this.args.waitForCustomization,
  }));
}
