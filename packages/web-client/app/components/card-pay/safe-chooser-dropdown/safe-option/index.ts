import Component from '@glimmer/component';
import { Profile } from '@cardstack/web-client/resources/profile';
import { MerchantSafe, Safe } from '@cardstack/cardpay-sdk';

interface CardPaySafeChooserDropdownSafeOptionComponentArgs {
  safe: Safe;
}

export default class CardPaySafeChooserDropdownSafeOptionComponent extends Component<CardPaySafeChooserDropdownSafeOptionComponentArgs> {
  get data() {
    if (this.args.safe.type === 'merchant') {
      let profile = this.args.safe as MerchantSafe;

      return {
        type: 'Profile',
        info: Profile.from(this, () => ({
          infoDID: profile.infoDID,
        })),
      };
    } else if (this.args.safe.type === 'depot') {
      return {
        icon: 'depot',
        info: {
          name: 'DEPOT',
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
