import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { PaymentLinkMode } from '@cardstack/ssr-web/components/common/payment-link';
import CardstackLogoForQR from '@cardstack/ssr-web/images/icons/cardstack-logo-opaque-bg.svg';
interface PaymentRequestArgs {
  profileAddress: string;
  paymentURL: string;
  deepLinkPaymentURL: string;
  image: string;
  canDeepLink: boolean;
  profile?: {
    name: string;
    backgroundColor: string;
    textColor: string;
  };
  amount?: string;
  secondaryAmount?: string;
}

export default class PaymentRequest extends Component<PaymentRequestArgs> {
  @tracked paymentLinkMode: PaymentLinkMode = this.args.canDeepLink
    ? 'link'
    : 'qr-non-mobile';
  cardstackLogoForQR = CardstackLogoForQR;

  get addressSegments() {
    let addressLength = 42;
    let breaks = [6, addressLength - 4];
    return [
      {
        text: this.args.profileAddress.slice(0, breaks[0]),
        bold: true,
      },
      {
        text: this.args.profileAddress.slice(breaks[0], breaks[1]),
        bold: false,
      },
      {
        text: this.args.profileAddress.slice(breaks[1]),
        bold: true,
      },
    ];
  }
}
