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
import { fromWei, toBN } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';

export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainName = 'L2 Test Chain';
  chainId = '-1';
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  waitForAccountDeferred = defer();
  bridgingDeferred!: RSVP.Deferred<TransactionReceipt>;
  @tracked defaultTokenBalance: BN | undefined;

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([]);
    return this.waitForAccount as Promise<void>;
  }

  getBlockHeight(): Promise<BN> {
    return Promise.resolve(toBN(0));
  }

  // eslint-disable-next-line no-unused-vars
  fetchDepot(_owner: ChainAddress): Promise<DepotSafe | null> {
    return Promise.resolve(null);
  }

  awaitBridged(
    _fromBlock: BN, // eslint-disable-line no-unused-vars
    _receiver: string // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt> {
    this.bridgingDeferred = defer<TransactionReceipt>();
    return this.bridgingDeferred.promise as Promise<TransactionReceipt>;
  }

  // eslint-disable-next-line no-unused-vars
  async updateUsdConverters(symbolsToUpdate: ConvertibleSymbol[]) {
    this.test__lastSymbolsToUpdate = symbolsToUpdate;
    let result = {} as Record<ConvertibleSymbol, ConversionFunction>;
    for (let symbol of symbolsToUpdate) {
      result[symbol] = (amountInWei: string) => {
        return Number(fromWei(amountInWei)) * this.test__simulatedExchangeRate;
      };
    }
    if (this.test__updateUsdConvertersDeferred) {
      await this.test__updateUsdConvertersDeferred.promise;
    }
    return Promise.resolve(result);
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  test__lastSymbolsToUpdate: ConvertibleSymbol[] = [];
  test__simulatedExchangeRate: number = 0.2;
  test__updateUsdConvertersDeferred: RSVP.Deferred<void> | undefined;

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
}
