import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer2Web3Strategy, TransactionHash } from './types';
import {
  BridgeableSymbol,
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import RSVP, { defer } from 'rsvp';
import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import { BridgeValidationResult, DepotSafe } from '@cardstack/cardpay-sdk';
import {
  UnbindEventListener,
  SimpleEmitter,
} from '@cardstack/web-client/utils/events';

export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainId = '-1';
  simpleEmitter = new SimpleEmitter();
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  waitForAccountDeferred = defer();
  bridgingToLayer2Deferred!: RSVP.Deferred<TransactionReceipt>;
  bridgingToLayer1HashDeferred!: RSVP.Deferred<TransactionHash>;
  bridgingToLayer1Deferred!: RSVP.Deferred<BridgeValidationResult>;
  @tracked isFetchingDepot = false;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked depotSafe: DepotSafe | null = null;
  issuePrepaidCardDeferredForNumber: Map<
    number,
    RSVP.Deferred<String>
  > = new Map();

  // property to test whether the refreshBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  async initialize() {}

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

  awaitBridgedToLayer2(
    _fromBlock: BN,
    _receiver: string
  ): Promise<TransactionReceipt> {
    this.bridgingToLayer2Deferred = defer<TransactionReceipt>();
    return this.bridgingToLayer2Deferred.promise as Promise<TransactionReceipt>;
  }

  bridgeToLayer1(
    _safeAddress: string,
    _tokenSymbol: BridgeableSymbol,
    _amountInWei: string
  ): Promise<TransactionHash> {
    this.bridgingToLayer1HashDeferred = defer<TransactionHash>();
    this.bridgingToLayer1Deferred = defer<BridgeValidationResult>();
    return this.bridgingToLayer1HashDeferred.promise;
  }

  awaitBridgedToLayer1(
    _fromBlock: BN,
    _txnHash: string
  ): Promise<BridgeValidationResult> {
    return this.bridgingToLayer1Deferred
      .promise as Promise<BridgeValidationResult>;
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

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  get isConnected() {
    return this.walletInfo.accounts.length > 0;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async convertFromSpend(symbol: ConvertibleSymbol, amount: number) {
    return await this.test__simulateConvertFromSpend(symbol, amount);
  }

  async issuePrepaidCard(
    _safeAddress: string,
    faceValue: number,
    _customizationDID: string
  ): Promise<String> {
    let deferred: RSVP.Deferred<String> = defer();
    this.issuePrepaidCardDeferredForNumber.set(faceValue, deferred);
    return deferred.promise;
  }

  authenticate(): Promise<string> {
    this.test__deferredHubAuthentication = defer();
    return this.test__deferredHubAuthentication.promise;
  }

  test__lastSymbolsToUpdate: ConvertibleSymbol[] = [];
  test__simulatedExchangeRate: number = 0.2;
  test__updateUsdConvertersDeferred: RSVP.Deferred<void> | undefined;
  test__deferredHubAuthentication!: RSVP.Deferred<string>;

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

  test__simulateBridgedToLayer2(txnHash: TransactionHash) {
    this.bridgingToLayer2Deferred.resolve({
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

  test__simulateConvertFromSpend(symbol: ConvertibleSymbol, amount: number) {
    let spendToDaiSimRate = 0.01;
    if (symbol === 'DAI') {
      return toWei(`${amount * spendToDaiSimRate}`);
    } else {
      return '0';
    }
  }

  test__simulateIssuePrepaidCardForAmount(
    faceValue: number,
    walletAddress: string
  ) {
    return this.issuePrepaidCardDeferredForNumber
      .get(faceValue)
      ?.resolve(walletAddress);
  }

  test__simulateHubAuthentication(authToken: string) {
    return this.test__deferredHubAuthentication.resolve(authToken);
  }

  test__simulateBridgedToLayer1() {
    this.bridgingToLayer1Deferred.resolve({
      messageId: 'example-message-id',
      encodedData: 'example-encoded-data',
      signatures: ['example-sig'],
    });
  }
}
