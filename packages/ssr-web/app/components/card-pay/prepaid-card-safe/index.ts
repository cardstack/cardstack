import Component from '@glimmer/component';
import { CardCustomization } from '@cardstack/ssr-web/resources/card-customization';
import { PrepaidCardSafe } from '@cardstack/cardpay-sdk';
import { useResource } from 'ember-resources';

interface CardPayPrepaidCardSafeComponentArgs {
  safe: PrepaidCardSafe;
  waitForCustomization?: boolean;
}

export default class CardPayPrepaidCardSafeComponent extends Component<CardPayPrepaidCardSafeComponentArgs> {
  customization = useResource(this, CardCustomization, () => ({
    customizationDID: this.args.safe.customizationDID,
    waitForCustomization: this.args.waitForCustomization,
  }));
}
