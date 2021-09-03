import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class PaymentRequest extends Component {
  @tracked showAsQR = false;
}
