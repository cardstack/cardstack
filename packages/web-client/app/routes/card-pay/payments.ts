import BaseRoute from './base';
import '../../css/card-pay/payments.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/profiles-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/profiles-summary-hero.svg';

const MERCHANTS_PANEL = {
  title: 'Quick Payments',
  description:
    'Accept payments and tips backed by stablecoins with automatically managed currency conversions',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'create-business',
      icon: 'profiles',
      title: 'Request Payments',
      description: `Set up your profile and start receiving payments in just a few minutes!`,
      bullets: [
        'Create a profile',
        'Request and receive payments from customers, fans, and friends via QR code or short link',
        'Review your transaction history',
        'Confirm transactions with Touch ID or Face ID in the Cardstack Wallet mobile app',
      ],
      cta: 'Create Profile',
      isCtaDisabled: false,
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
