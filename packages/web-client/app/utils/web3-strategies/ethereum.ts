import { tracked } from '@glimmer/tracking';
import { Layer1Web3Strategy, TransactionHash } from './types';
import BN from 'bn.js';
import { WalletProvider } from '../wallet-providers';
import { defer } from 'rsvp';
import { TransactionReceipt } from 'web3-core';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk/index.js';
import { UnbindEventListener } from '@cardstack/web-client/utils/events';

export default class EthereumWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Ethereum mainnet';
  chainId = 1;
  isConnected: boolean = false;
  walletConnectUri: string | undefined;
  #waitForAccountDeferred = defer<void>();

  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  @tracked currentProviderId: string | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;

  connect(walletProvider: WalletProvider): Promise<void> {
    throw new Error(`Method not implemented. ${walletProvider}`);
  }

  disconnect(): Promise<void> {
    throw new Error(`Method not implemented.`);
  }

  // eslint-disable-next-line no-unused-vars
  on(event: string, cb: Function): UnbindEventListener {
    throw new Error('Method not implemented');
  }

  approve(
    _amountInWei: BN, // eslint-disable-line no-unused-vars
    _token: string // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt> {
    throw new Error('Method not implemented.');
  }

  relayTokens(
    _token: string, // eslint-disable-line no-unused-vars
    _destinationAddress: string, // eslint-disable-line no-unused-vars
    _amountInWei: BN // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt> {
    throw new Error('Method not implemented.');
  }

  blockExplorerUrl(txnHash: TransactionHash) {
    return `${getConstantByNetwork('blockExplorer', 'mainnet')}/tx/${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork('bridgeExplorer', 'mainnet')}/${txnHash}`;
  }
}
