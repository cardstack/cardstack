import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import UA from '@cardstack/ssr-web/services/ua';
import { PaymentLinkMode } from '../components/common/payment-link';

export default class IndexController extends Controller {
  @service('ua') declare UAService: UA;
  @tracked paymentLinkMode: PaymentLinkMode = 'link';

  constructor() {
    super(...arguments);
    if (!this.canDeepLink) {
      this.paymentLinkMode = 'qr-non-mobile';
    }
  }

  @action setPaymentLinkMode(mode: PaymentLinkMode) {
    this.paymentLinkMode = mode;
  }

  get canDeepLink() {
    return this.UAService.isIOS() || this.UAService.isAndroid();
  }
}
