import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import {
  IssuePrepaidCardOptions,
  Layer2Web3Strategy,
  TransactionHash,
} from './types';
import {
  BridgeableSymbol,
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import RSVP, { defer } from 'rsvp';
import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import {
  BridgeValidationResult,
  DepotSafe,
  PrepaidCardSafe,
  Safe,
} from '@cardstack/cardpay-sdk';
import {
  UnbindEventListener,
  SimpleEmitter,
} from '@cardstack/web-client/utils/events';
import { task, TaskGenerator } from 'ember-concurrency';

interface IssuePrepaidCardRequest {
  deferred: RSVP.Deferred<PrepaidCardSafe>;
  onTxHash?: (txHash: TransactionHash) => void;
  onNonce?: (nonce: string) => void;
  nonce?: string;
  customizationDID: string;
}

interface SimulateBalancesParams {
  defaultToken?: BN;
  dai?: BN;
  card?: BN;
}
export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainId = '-1';
  simpleEmitter = new SimpleEmitter();
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([]);
  waitForAccountDeferred = defer();
  bridgingToLayer2Deferred!: RSVP.Deferred<TransactionReceipt>;
  bridgingToLayer1HashDeferred!: RSVP.Deferred<TransactionHash>;
  bridgingToLayer1Deferred!: RSVP.Deferred<BridgeValidationResult>;
  @tracked isFetchingDepot = false;
  @tracked daiBalance: BN | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked depotSafe: DepotSafe | null = null;
  @tracked isInitializing = false;
  issuePrepaidCardRequests: Map<number, IssuePrepaidCardRequest> = new Map();
  accountSafes: Map<string, Safe[]> = new Map();

  // property to test whether the refreshBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  @task *initializeTask(): TaskGenerator<void> {
    yield '';
    return;
  }

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

  async viewSafe(address: string): Promise<Safe | undefined> {
    return Promise.resolve(
      [...this.accountSafes.values()]
        .flat()
        .find((safe) => safe.address === address)
    );
  }

  async viewSafes(account: string): Promise<Safe[]> {
    return Promise.resolve(this.accountSafes.get(account)!);
  }

  test__simulateAccountSafes(account: string, safes: Safe[]) {
    if (!this.accountSafes.has(account)) {
      this.accountSafes.set(account, []);
    }

    this.accountSafes.get(account)?.push(...safes);
  }

  async issuePrepaidCard(
    _safeAddress: string,
    faceValue: number,
    customizationDID: string,
    options: IssuePrepaidCardOptions
  ): Promise<PrepaidCardSafe> {
    let deferred: RSVP.Deferred<PrepaidCardSafe> = defer();
    this.issuePrepaidCardRequests.set(faceValue, {
      deferred,
      onTxHash: options.onTxHash,
      onNonce: options.onNonce,
      nonce: options.nonce,
      customizationDID,
    });
    return deferred.promise;
  }

  authenticate(): Promise<string> {
    this.test__deferredHubAuthentication = defer();
    return this.test__deferredHubAuthentication.promise;
  }

  checkHubAuthenticationValid(_authToken: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  test__lastSymbolsToUpdate: ConvertibleSymbol[] = [];
  test__simulatedExchangeRate: number = 0.2;
  test__updateUsdConvertersDeferred: RSVP.Deferred<void> | undefined;
  test__deferredHubAuthentication!: RSVP.Deferred<string>;

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[]) {
    let newWalletInfo = new WalletInfo(accounts);

    if (
      this.walletInfo.firstAddress &&
      newWalletInfo.firstAddress &&
      !this.walletInfo.isEqualTo(newWalletInfo)
    ) {
      this.simpleEmitter.emit('account-changed');
    }

    this.walletInfo = newWalletInfo;
    this.waitForAccountDeferred.resolve();
  }

  test__simulateBalances(balances: SimulateBalancesParams) {
    if (balances.dai) {
      this.daiBalance = balances.dai;
    }

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

  test__getNonceForIssuePrepaidCardRequest(
    faceValue: number
  ): string | undefined {
    let request = this.issuePrepaidCardRequests.get(faceValue);
    return request?.nonce;
  }

  test__simulateOnNonceForIssuePrepaidCardRequest(
    faceValue: number,
    nonce: string
  ): void {
    let request = this.issuePrepaidCardRequests.get(faceValue);
    request?.onNonce?.(nonce);
  }

  test__simulateIssuePrepaidCardForAmount(
    faceValue: number,
    walletAddress: string,
    cardAddress: string,
    options: Object
  ) {
    let request = this.issuePrepaidCardRequests.get(faceValue);
    let prepaidCardSafe: PrepaidCardSafe = {
      type: 'prepaid-card',
      createdAt: Date.now() / 1000,
      address: cardAddress,
      tokens: [],
      owners: [walletAddress],
      issuingToken: '0xTOKEN',
      spendFaceValue: faceValue,
      prepaidCardOwner: walletAddress,
      hasBeenUsed: false,
      issuer: walletAddress,
      reloadable: true,
      transferrable: false,
      customizationDID: request?.customizationDID,

      ...options,
    };
    request?.onTxHash?.('exampleTxHash');

    this.test__simulateAccountSafes(walletAddress, [prepaidCardSafe]);

    return request?.deferred.resolve(prepaidCardSafe);
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
