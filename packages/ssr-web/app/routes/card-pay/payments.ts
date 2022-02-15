import BaseRoute from './base';
import '../../css/card-pay/payments.css';
import heroImageUrl from '@cardstack/ssr-web/images/dashboard/merchants-hero.svg';
import summaryHeroImageUrl from '@cardstack/ssr-web/images/dashboard/merchants-summary-hero.svg';
import config from '@cardstack/ssr-web/config/environment';

const MERCHANTS_PANEL = {
  title: 'Quick Payments',
  description:
    'Accept payments and tips backed by stablecoins with automatically managed currency conversions',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'create-business',
      icon: 'merchants',
      title: 'Payments',
      description: `Set up your business account and start receiving payments in just a few minutes!`,
      bullets: [
        'Create a business account',
        'Request and receive payments from customers, fans, and friends via QR code or short link',
        'Review your transaction history',
        'Confirm transactions with Touch ID or Face ID in the Card Wallet mobile app',
      ],
      cta: 'Create Business Account',
      isCtaDisabled: !config.features.createMerchant,
    },
  ],
};

export default class CardPayBusinessServicesRoute extends BaseRoute {
  model(params: any, transition: any) {
    super.model(params, transition);
    return {
      panel: MERCHANTS_PANEL,
    };
  }
}
