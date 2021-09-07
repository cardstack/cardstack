import Component from '@glimmer/component';
import { MerchantInfo } from '@cardstack/web-client/resources/merchant-info';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import { useResource } from 'ember-resources';

interface CardPaySafeChooserDropdownMerchantOptionComponentArgs {
  safe: MerchantSafe;
}

export default class CardPaySafeChooserDropdownMerchantOptionComponent extends Component<CardPaySafeChooserDropdownMerchantOptionComponentArgs> {
  info = useResource(this, MerchantInfo, () => ({
    infoDID: this.args.safe.infoDID,
  }));
}
