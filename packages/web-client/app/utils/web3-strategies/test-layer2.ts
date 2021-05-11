import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import {
  ChainAddress,
  ConversionFunction,
  ConvertibleSymbol,
  Layer2Web3Strategy,
  TransactionHash,
} from './types';
import RSVP, { defer } from 'rsvp';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import { SafeInfo } from '@cardstack/cardpay-sdk/sdk/safes';

export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainName = 'L2 Test Chain';
  chainId = '-1';
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  waitForAccountDeferred = defer();
  bridgingDeferred!: RSVP.Deferred<unknown>;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked usdConverters: {
    [symbol: string]: (amountInWei: string) => number; // eslint-disable-line no-unused-vars
  } = {
    // eslint-disable-next-line no-unused-vars
    DAI: (_amountInWei: string) => {
      return 0;
    },
    // eslint-disable-next-line no-unused-vars
    CARD: (_amountInWei: string) => {
      return 0;
    },
  };

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([]);
    return this.waitForAccount as Promise<void>;
  }

  getBlockHeight(): Promise<BN> {
    return Promise.resolve(toBN(0));
  }

  // eslint-disable-next-line no-unused-vars
  fetchDepot(_owner: ChainAddress): Promise<SafeInfo | null> {
    return Promise.resolve(null);
  }

  awaitBridged(
    _fromBlock: BN, // eslint-disable-line no-unused-vars
    _receiver: string // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt> {
    this.bridgingDeferred = defer<TransactionReceipt>();
    return this.bridgingDeferred.promise as Promise<TransactionReceipt>;
  }

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[]) {
    this.isConnected = true;
    this.walletInfo = new WalletInfo(accounts, parseInt(this.chainId, 10));
    this.waitForAccountDeferred.resolve();
  }

  test__simulateBalances(balances: { defaultToken: BN | undefined }) {
    if (balances.defaultToken) {
      this.defaultTokenBalance = balances.defaultToken;
    }
  }

  test__simulateBridged(txnHash: TransactionHash) {
    this.bridgingDeferred.resolve({
      transactionHash: txnHash,
    } as TransactionReceipt);
  }

  // eslint-disable-next-line no-unused-vars
  async updateUsdConverters(_symbolsToUpdate: ConvertibleSymbol[]) {
    return {} as Record<ConvertibleSymbol, ConversionFunction>;
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }
}
