import BaseRoute from './base';
import '../../css/card-pay/balances.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/balances-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/balances-summary-hero.svg';

const BALANCES_PANEL = {
  title: 'Easy Payments',
  description: 'DeFi payments that are fast, easy and cheap for everyone',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'buy-prepaid-card',
      icon: 'balances-customers',
      title: 'Customers',
      description: `You need a prepaid card to pay for products and services
        offered by businesses in the Card Pay network. To start, you can buy
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
      workflow: 'issue-prepaid-card',
      icon: 'balances-issuers',
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
    },
  ],
};

export default class CardPayBalancesRoute extends BaseRoute {
  model(params: any, transition: any) {
    super.model(params, transition);
    return {
      panel: BALANCES_PANEL,
    };
  }
}
