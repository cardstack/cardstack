import Route from '@ember/routing/route';
import heroImageUrl from '@cardstack/web-client/images/dashboard/suppliers-hero.svg';

const SUPPLIERS_PANEL = {
  title: 'Easy Rewards',
  description:
    'Token bridging between layer 1 and layer 2 with protocol fees as rewards',
  heroImageUrl,
  sections: [
    {
      workflow: 'deposit',
      icon: 'suppliers',
      title: 'Token Suppliers',
      description: `Deposit tokens from your mainnet wallet into the CARD Protocol’s reserve pool to receive an equivalent amount of CPXD tokens in your xDai chain wallet.`,
      bullets: [
        'Deposit funds into the CARD Protocol reserve pool and earn rewards',
        'Bridge tokens from Ethereum mainnet to xDai chain',
      ],
      cta: 'Deposit Tokens',
    },
    {
      workflow: 'withdrawal',
      icon: 'suppliers-merchants',
      title: 'Token Suppliers & Merchants',
      description: `Withdraw tokens from your xDai chain wallet to receive an equivalent amount of tokens in your mainnet wallet.`,
      bullets: [
        'Inspect your balances on Ethereum mainnet and xDai chain',
        'Withdraw funds from your xDai chain wallet to your mainnet wallet',
      ],
      cta: 'Withdraw Tokens',
    },
  ],
};

export default class CardPayTokenSuppliersRoute extends Route {
  model() {
    return {
      panel: SUPPLIERS_PANEL,
    };
  }
}
