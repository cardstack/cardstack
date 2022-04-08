import BaseRoute from './base';
import '../../css/card-pay/deposit-withdrawal.css';
import heroImageUrl from '@cardstack/web-client/images/dashboard/suppliers-hero.svg';
import summaryHeroImageUrl from '@cardstack/web-client/images/dashboard/suppliers-summary-hero.svg';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import config from '@cardstack/web-client/config/environment';

const SUPPLIERS_PANEL = {
  title: 'Easy Deposits & Withdrawals',
  description: 'Token bridging between layer 1 and layer 2',
  heroImageUrl,
  summaryHeroImageUrl,
  sections: [
    {
      workflow: 'deposit',
      icon: 'deposit-route',
      buttonIcon: 'plus',
      title: 'Deposits',
      description: `Deposit tokens from your ${c.layer1.conversationalName} wallet into the CARD Protocol’s reserve pool to receive an equivalent amount of CPXD tokens in your Card Wallet.`,
      bullets: [
        'Deposit funds into the CARD Protocol reserve pool and earn rewards',
        `Bridge tokens from ${c.layer1.fullName} to ${c.layer2.fullName}`,
      ],
      cta: 'Deposit Tokens',
    },
    {
      workflow: 'withdrawal',
      icon: 'withdrawal-route',
      buttonIcon: 'minus',
      title: 'Withdrawals',
      description: `Withdraw CPXD tokens from your Card Wallet to receive an equivalent amount of tokens in your ${c.layer1.conversationalName} wallet.`,
      bullets: [
        `Withdraw from a depot or payment profile in your Card Wallet`,
        `Bridge tokens from ${c.layer2.fullName} to ${c.layer1.fullName}`,
      ],
      cta: 'Withdraw Tokens',
    },
  ],
};

export default class CardPayDepositWithdrawalRoute extends BaseRoute {
  model(params: any, transition: any) {
    super.model(params, transition);
    return {
      panel: SUPPLIERS_PANEL,
    };
  }
}
