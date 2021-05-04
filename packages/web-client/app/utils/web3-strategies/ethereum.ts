import { tracked } from '@glimmer/tracking';
import { Layer1Web3Strategy, TransactionHash } from './types';
import { BigNumber } from '@ethersproject/bignumber';
import { WalletProvider } from '../wallet-providers';
import { defer } from 'rsvp';
import { TransactionReceipt } from 'web3-core';

export default class EthereumWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Ethereum Mainnet';
  chainId = 1;
  isConnected: boolean = false;
  walletConnectUri: string | undefined;
  #waitForAccountDeferred = defer<void>();
  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  @tracked currentProviderId: string | undefined;
  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: BigNumber | undefined;
  @tracked cardBalance: BigNumber | undefined;

  connect(walletProvider: WalletProvider): Promise<void> {
    throw new Error(`Method not implemented. ${walletProvider}`);
  }

  disconnect(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  approve(
    _amountInWei: BigNumber, // eslint-disable-line no-unused-vars
    _token: string // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt> {
    throw new Error('Method not implemented.');
  }

  relayTokens(
    _amountInWei: BigNumber, // eslint-disable-line no-unused-vars
    _token: string, // eslint-disable-line no-unused-vars
    _destinationAddress: string // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line no-unused-vars
  txnViewerUrl(_txnHash: TransactionHash): string {
    throw new Error('Method not implemented.');
  }
}
