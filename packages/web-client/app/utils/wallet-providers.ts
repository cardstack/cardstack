import metamaskLogo from '@cardstack/web-client/images/logos/metamask-logo.svg';
import walletConnectLogo from '@cardstack/web-client/images/logos/wallet-connect-logo.svg';

export type WalletProviderId = 'metamask' | 'wallet-connect';
export interface WalletProvider {
  id: WalletProviderId;
  name: string;
  logo: string;
  iconName?: string;
}

const walletProviders: WalletProvider[] = [
  {
    id: 'wallet-connect',
    name: 'WalletConnect',
    logo: walletConnectLogo,
    iconName: 'wallet-connect-logo',
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    logo: metamaskLogo,
    iconName: 'metamask-logo',
  },
];

export default walletProviders;
