import metamaskLogo from '@cardstack/web-client/images/logos/metamask-logo.svg';
import walletConnectLogo from '@cardstack/web-client/images/logos/wallet-connect-logo.svg';

export interface WalletProvider {
  id: string;
  name: string;
  logo: string;
}

const walletProviders: WalletProvider[] = [
  {
    id: 'metamask',
    name: 'Metamask',
    logo: metamaskLogo,
  },
  {
    id: 'wallet-connect',
    name: 'WalletConnect',
    logo: walletConnectLogo,
  },
];

export default walletProviders;
