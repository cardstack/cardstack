import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer2Web3Strategy, TransactionHash } from './types';
import {
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import RSVP, { defer } from 'rsvp';
import BN from 'bn.js';
import { fromWei } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';
import {
  UnbindEventListener,
  SimpleEmitter,
} from '@cardstack/web-client/utils/events';

export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainName = 'L2 test chain';
  chainId = '-1';
  simpleEmitter = new SimpleEmitter();
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  waitForAccountDeferred = defer();
  bridgingDeferred!: RSVP.Deferred<TransactionReceipt>;
  @tracked isFetchingDepot = false;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked depotSafe: DepotSafe | null = null;

  // property to test whether the refreshBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([]);
    this.simpleEmitter.emit('disconnect');
    return this.waitForAccount as Promise<void>;
  }

  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  test__simulateDisconnectFromWallet() {
    this.disconnect();
  }

  getBlockHeight(): Promise<BN> {
    return Promise.resolve(new BN('0'));
  }

  refreshBalances() {
    this.balancesRefreshed = true;
  }

  fetchDepotTask(): any {
    return Promise.resolve(this.depotSafe);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  awaitBridged(_fromBlock: BN, _receiver: string): Promise<TransactionReceipt> {
    this.bridgingDeferred = defer<TransactionReceipt>();
    return this.bridgingDeferred.promise as Promise<TransactionReceipt>;
  }

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

  get isConnected() {
    return this.walletInfo.accounts.length > 0;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async issuePrepaidCard(): Promise<string> {
    return Promise.resolve('2423');
  }

  test__lastSymbolsToUpdate: ConvertibleSymbol[] = [];
  test__simulatedExchangeRate: number = 0.2;
  test__updateUsdConvertersDeferred: RSVP.Deferred<void> | undefined;

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[]) {
    this.walletInfo = new WalletInfo(accounts, parseInt(this.chainId, 10));
    this.waitForAccountDeferred.resolve();
  }

  test__simulateBalances(balances: { defaultToken?: BN; card?: BN }) {
    if (balances.defaultToken) {
      this.defaultTokenBalance = balances.defaultToken;
    }

    if (balances.card) {
      this.cardBalance = balances.card;
    }
  }

  test__simulateBridged(txnHash: TransactionHash) {
    this.bridgingDeferred.resolve({
      transactionHash: txnHash,
    } as TransactionReceipt);
  }

  test__simulateDepot(depot: DepotSafe | null) {
    if (depot) {
      this.depotSafe = depot;
      return;
    }
    this.depotSafe = null;
  }
}
