import Route from '@ember/routing/route';
// import '../../css/card-pay/balances.css';

const MERCHANTS_PANEL = {
  title: 'Easy Earnings',
  description:
    'Revenue backed by stablecoins with automatically managed currency conversions',
  heroImageUrl: '/images/dashboard/merchants-hero.svg',
  sections: [
    {
      icon: 'marchants-1',
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
      icon: 'merchants-2-payment',
      description: `Send your customers a link or a QR code they can scan to make a payment.`,
      cta: 'Request Payment',
      isCtaDisabled: true,
      footnote: `This is possible once you have connected your xDai chain wallet and created a merchant.`,
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
