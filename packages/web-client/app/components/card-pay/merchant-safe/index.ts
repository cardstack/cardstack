import Component from '@glimmer/component';
import { MerchantInfo } from '@cardstack/web-client/resources/merchant-info';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import { useResource } from 'ember-resources';

interface CardPayMerchantSafeComponentArgs {
  safe: MerchantSafe;
  waitForInfo?: boolean;
}

export default class CardPayMerchantSafeComponent extends Component<CardPayMerchantSafeComponentArgs> {
  info = useResource(this, MerchantInfo, () => ({
    infoDID: this.args.safe.infoDID,
    waitForInfo: this.args.waitForInfo,
  }));
}
