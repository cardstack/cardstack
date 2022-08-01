import Component from '@glimmer/component';
import { CardCustomization } from '@cardstack/web-client/resources/card-customization';
import { PrepaidCardSafe } from '@cardstack/cardpay-sdk';

interface CardPayPrepaidCardSafeComponentArgs {
  safe: PrepaidCardSafe;
  waitForCustomization?: boolean;
}

export default class CardPayPrepaidCardSafeComponent extends Component<CardPayPrepaidCardSafeComponentArgs> {
  customization = CardCustomization.from(this, () => {
    return {
      customizationDID: this.args.safe?.customizationDID,
      waitForCustomization: this.args.waitForCustomization,
    };
  });
}
