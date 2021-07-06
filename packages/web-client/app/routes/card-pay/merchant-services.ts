import Route from '@ember/routing/route';
import heroImageUrl from '@cardstack/web-client/images/dashboard/merchants-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/merchants-summary-hero.svg';

const MERCHANTS_PANEL = {
  title: 'Easy Earnings',
  description:
    'Revenue backed by stablecoins with automatically managed currency conversions',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'create-merchant',
      icon: 'merchants',
      title: 'Merchants',
      description: `Set up your merchant account and start receiving payments via Card Pay in just a few minutes!`,
      bullets: [
        'Create a merchant account',
        'Request and receive payments from customers via QR code scanning',
        'Inspect your earnings and transaction history',
        'Confirm transactions with Touch ID or Face ID in the Card Wallet mobile app',
      ],
      cta: 'Create Merchant',
      isCtaDisabled: true,
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

export default class CardPayMerchantServicesRoute extends Route {
  model() {
    return {
      panel: MERCHANTS_PANEL,
    };
  }
}
