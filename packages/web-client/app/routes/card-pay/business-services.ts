import BaseRoute from './base';
import '../../css/card-pay/business-services.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/merchants-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/merchants-summary-hero.svg';
import config from '@cardstack/web-client/config/environment';

const MERCHANTS_PANEL = {
  title: 'Easy Earnings',
  description:
    'Revenue backed by stablecoins with automatically managed currency conversions',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'create-business',
      icon: 'merchants',
      title: 'Business Accounts',
      description: `Set up your business account and start receiving payments via Card Pay in just a few minutes!`,
      bullets: [
        'Create a business account',
        'Request and receive payments from customers via QR code scanning',
        'Inspect your earnings and transaction history',
        'Confirm transactions with Touch ID or Face ID in the Card Wallet mobile app',
      ],
      cta: 'Create Business Account',
      isCtaDisabled: !config.features.createMerchant,
    },
    {
      workflow: 'request-payment',
      icon: 'merchants-payment',
      description: `Send your customers a link or a QR code they can scan to make a payment.`,
      cta: 'Request Payment',
      isCtaDisabled: true,
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
