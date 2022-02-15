import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

interface PaymentRequestArgs {
  merchantAddress: string;
  paymentURL: string;
  deepLinkPaymentURL: string;
  image: string;
  canDeepLink: boolean;
  merchant?: {
    name: string;
    backgroundColor: string;
    textColor: string;
  };
  amount?: string;
  secondaryAmount?: string;
}

export default class PaymentRequest extends Component<PaymentRequestArgs> {
  @tracked showAsQR = false;

  get addressSegments() {
    let addressLength = 42;
    let breaks = [6, addressLength - 4];
    return [
      {
        text: this.args.merchantAddress.slice(0, breaks[0]),
        bold: true,
      },
      {
        text: this.args.merchantAddress.slice(breaks[0], breaks[1]),
        bold: false,
      },
      {
        text: this.args.merchantAddress.slice(breaks[1]),
        bold: true,
      },
    ];
  }
}
