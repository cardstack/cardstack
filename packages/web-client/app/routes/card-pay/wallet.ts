import BaseRoute from './base';
import '../../css/card-pay/wallet.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/balances-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/balances-summary-hero.svg';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import DashboardPanel from '../../components/card-pay/dashboard-panel/panel';

const WALLET_PANEL: DashboardPanel = {
  title: 'Simple Wallet',
  description: 'DeFi payments that are fast, easy and cheap for everyone',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'issue-prepaid-card',
      icon: 'prepaid-cards',
      title: 'Issue a prepaid card',
      description: `Use the available balance in your profile or depot to issue a prepaid card.`,
      bullets: [
        'Choose your own design for your prepaid card',
        `Issue your prepaid card with ${c.layer2.daiToken}`,
      ],
      cta: 'Issue Prepaid Card',
      isCtaDisabled: false,
    },
  ],
};

export default class CardPayWalletRoute extends BaseRoute {
  model(params: any, transition: any): { panel: DashboardPanel } {
    super.model(params, transition);
    return {
      panel: WALLET_PANEL,
    };
  }
}
