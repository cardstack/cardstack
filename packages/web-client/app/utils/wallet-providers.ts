import metamaskLogo from '@cardstack/web-client/images/logos/metamask-logo.svg';
import walletConnectLogo from '@cardstack/web-client/images/logos/wallet-connect-logo.svg';
import torusLogo from '@cardstack/web-client/images/logos/torus-logo.svg';
import fortmaticLogo from '@cardstack/web-client/images/logos/fortmatic-logo.svg';
import authereumLogo from '@cardstack/web-client/images/logos/authereum-logo.svg';
import bitskiLogo from '@cardstack/web-client/images/logos/bitski-logo.svg';

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
  {
    id: 'torus',
    name: 'Torus',
    logo: torusLogo,
  },
  {
    id: 'fortmatic',
    name: 'Fortmatic',
    logo: fortmaticLogo,
  },
  {
    id: 'authereum',
    name: 'Authereum',
    logo: authereumLogo,
  },
  {
    id: 'bitski',
    name: 'Bitski',
    logo: bitskiLogo,
  },
];

export default walletProviders;
