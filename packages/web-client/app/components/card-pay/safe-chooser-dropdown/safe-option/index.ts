import Component from '@glimmer/component';
import { MerchantInfo } from '@cardstack/web-client/resources/merchant-info';
import { MerchantSafe, Safe } from '@cardstack/cardpay-sdk';
import { useResource } from 'ember-resources';

interface CardPaySafeChooserDropdownSafeOptionComponentArgs {
  safe: Safe;
}

export default class CardPaySafeChooserDropdownSafeOptionComponent extends Component<CardPaySafeChooserDropdownSafeOptionComponentArgs> {
  get data() {
    if (this.args.safe.type === 'merchant') {
      let merchant = this.args.safe as MerchantSafe;

      return {
        type: 'Payment Profile',
        info: useResource(this, MerchantInfo, () => ({
          infoDID: merchant.infoDID,
        })),
      };
    } else if (this.args.safe.type === 'depot') {
      return {
        icon: 'depot',
        info: {
          name: 'DEPOT',
        },
      };
    } else if (this.args.safe.type === 'reward') {
      return {
        icon: 'reward',
        info: {
          name: 'Rewards',
        },
      };
    } else {
      return {
        icon: 'question',
        info: {
          name: 'Unknown',
        },
      };
    }
  }
}
