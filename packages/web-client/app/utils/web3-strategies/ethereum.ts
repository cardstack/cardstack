import { tracked } from '@glimmer/tracking';
import { Layer1Web3Strategy } from './types';
import { BigNumber } from '@ethersproject/bignumber';
import { WalletProvider } from '../wallet-providers';
import { defer } from 'rsvp';

export default class EthereumWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Ethereum Mainnet';
  chainId = 1;
  isConnected: boolean = false;
  walletConnectUri: string | undefined;
  #waitForAccountDeferred = defer<void>();
  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: BigNumber | undefined;
  @tracked cardBalance: BigNumber | undefined;

  connect(walletProvider: WalletProvider): Promise<void> {
    throw new Error(`Method not implemented. ${walletProvider}`);
  }

  disconnect(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  unlock(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deposit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
