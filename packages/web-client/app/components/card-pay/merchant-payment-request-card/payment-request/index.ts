import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

interface PaymentRequestArgs {
  paymentURL: string;
}

export default class PaymentRequest extends Component<PaymentRequestArgs> {
  @tracked showAsQR = false;

  get deepLink() {
    // TODO: how do we get the deep link?
    return this.args.paymentURL;
  }
}
