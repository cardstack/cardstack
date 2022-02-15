import metamaskLogo from '@cardstack/ssr-web/images/logos/metamask-logo.svg';
import walletConnectLogo from '@cardstack/ssr-web/images/logos/wallet-connect-logo.svg';

export type WalletProviderId = 'metamask' | 'wallet-connect';
export interface WalletProvider {
  id: WalletProviderId;
  name: string;
  logo: string;
  iconName?: string;
}

const walletProviders: WalletProvider[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    logo: metamaskLogo,
    iconName: 'metamask-logo',
  },
  {
    id: 'wallet-connect',
    name: 'WalletConnect',
    logo: walletConnectLogo,
    iconName: 'wallet-connect-logo',
  },
];

export default walletProviders;
