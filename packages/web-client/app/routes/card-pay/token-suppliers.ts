import BaseRoute from './base';
import '../../css/card-pay/token-suppliers.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/suppliers-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/suppliers-summary-hero.svg';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

const SUPPLIERS_PANEL = {
  title: 'Easy Rewards',
  description:
    'Token bridging between layer 1 and layer 2 with protocol fees as rewards',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'deposit',
      icon: 'suppliers',
      title: 'Token Suppliers',
      description: `Deposit tokens from your ${c.layer1.conversationalName} wallet into the CARD Protocol’s reserve pool to receive an equivalent amount of CPXD tokens in your ${c.layer2.fullName} wallet.`,
      bullets: [
        'Deposit funds into the CARD Protocol reserve pool and earn rewards',
        `Bridge tokens from ${c.layer1.fullName} to ${c.layer2.fullName}`,
      ],
      cta: 'Deposit Tokens',
    },
    {
      workflow: 'withdrawal',
      icon: 'suppliers-merchants',
      title: 'Token Suppliers & Merchants',
      description: `Withdraw tokens from your ${c.layer2.fullName} wallet to receive an equivalent amount of tokens in your ${c.layer1.conversationalName} wallet.`,
      bullets: [
        `Inspect your balances on ${c.layer1.fullName} and ${c.layer2.fullName}`,
        `Withdraw funds from your ${c.layer2.fullName} wallet to your ${c.layer1.conversationalName} wallet`,
      ],
      cta: 'Withdraw Tokens',
    },
  ],
};

export default class CardPayTokenSuppliersRoute extends BaseRoute {
  model(params: any, transition: any) {
    super.model(params, transition);
    return {
      panel: SUPPLIERS_PANEL,
    };
  }
}
