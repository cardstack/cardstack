import Route from '@ember/routing/route';
import '../../css/card-pay/balances.css';

const BALANCES_PANEL = {
  title: 'Easy Payments',
  description: 'DeFi payments that are fast, easy and cheap for everyone',
  heroImageUrl: '/images/dashboard/balances-hero.svg',
  sections: [
    {
      icon: 'balances-1-customers',
      title: 'Customers',
      description: `You need a prepaid card to pay for products and services
        offered by merchants in the Card Pay network. To start, you can buy
        a prepaid card via Apple Pay in the Card Wallet mobile app.`,
      bullets: [
        'Pay with your prepaid card as you make purchases in the network',
        'Confirm your payments with Touch ID or Face ID in the Card Wallet mobile app',
        'Reload your prepaid card at any time',
        'Earn rewards for the purchases you make',
      ],
      cta: 'Buy Prepaid Card',
      isCtaDisabled: true,
    },
    {
      icon: 'balances-2-issuers',
      title: 'Issuers',
      description: `You can issue prepaid cards yourself, which you can use
        for purchases in the network or transfer to other users.`,
      bullets: [
        'Issue your own prepaid card with crypto funding',
        'Split a prepaid card into several cards of smaller denominations',
        'Transfer prepaid cards to other users and charge an issuance and/or processing fee',
        'Reload your prepaid cards by adding more crypto funds',
      ],
      cta: 'Issue Prepaid Card',
      footnote: `This is possible if you have a balance of DAI.CPXD in your xDai
        chain wallet. (You can deposit DAI from your mainnet wallet to get a
        balance of DAI.CPXD in your xDai chain wallet.)`,
    },
  ],
};

export default class CardPayBalancesRoute extends Route {
  model() {
    return {
      panel: BALANCES_PANEL,
    };
  }
}
