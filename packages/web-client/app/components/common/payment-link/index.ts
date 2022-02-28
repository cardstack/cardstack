// TODO: remove when pay route is removed from web client
import Component from '@glimmer/component';

/**
 * - qr-non-mobile: QR, no toggling views to link/qr.
 * - qr: QR, can toggle to link.
 * - link: link, can toggle to QR.
 */
export type PaymentLinkMode = 'qr-non-mobile' | 'qr' | 'link';

export default class PaymentLinkComponent extends Component<{
  canDeepLink: boolean;
  mode: PaymentLinkMode;
}> {
  get nextMode() {
    if (this.args.mode === 'qr-non-mobile') return '';
    else return this.args.mode === 'qr' ? 'link' : 'qr';
  }

  get showingQR() {
    return this.args.mode.startsWith('qr');
  }
}
