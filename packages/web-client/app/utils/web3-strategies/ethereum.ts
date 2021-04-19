import { tracked } from '@glimmer/tracking';
import { Layer1Web3Strategy } from './types';

export default class EthereumWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Ethereum Mainnet';
  chainId = 1;
  isConnected: boolean = false;
  walletConnectUri: string | undefined;

  @tracked defaultTokenBalance: number | undefined;
  @tracked daiBalance: number | undefined;
  @tracked cardBalance: number | undefined;

  unlock(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deposit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
