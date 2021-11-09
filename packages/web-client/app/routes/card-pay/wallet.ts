import BaseRoute from './base';
import '../../css/card-pay/balances.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/balances-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/balances-summary-hero.svg';

const WALLET_PANEL = {
  title: 'Simple Wallet',
  description: 'DeFi payments that are fast, easy and cheap for everyone',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'issue-prepaid-card',
      icon: 'balances-customers',
      title: 'Issue a Prepaid Card',
      description: `Use available balance in your merchant account or depot to issue a prepaid card.`,
      bullets: [
        'Choose your own design for your prepaid card.',
        'Issue your own prepaid card with DAI.CPXD',
      ],
      cta: 'Issue Prepaid Card',
      isCtaDisabled: false,
    },
  ],
};

export default class CardPayWalletRoute extends BaseRoute {
  model(params: any, transition: any) {
    super.model(params, transition);
    return {
      panel: WALLET_PANEL,
    };
  }
}
