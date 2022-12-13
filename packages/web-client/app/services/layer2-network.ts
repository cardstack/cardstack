import Service from '@ember/service';
import config from '../config/environment';
import { inject as service } from '@ember/service';
import { all, TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import {
  Layer2ChainEvent,
  Layer2Web3Strategy,
  TransactionHash,
  TxnBlockNumber,
  WithdrawalLimits,
} from '../utils/web3-strategies/types';
import { MerchantSafe, PrepaidCardSafe } from '@cardstack/cardpay-sdk';
import Layer2TestWeb3Strategy from '../utils/web3-strategies/test-layer2';
import GnosisWeb3Strategy from '../utils/web3-strategies/gnosis';
import SokolWeb3Strategy from '../utils/web3-strategies/sokol';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';
import BN from 'bn.js';
import { DepotSafe, Safe } from '@cardstack/cardpay-sdk';
import {
  ConvertibleSymbol,
  ConversionFunction,
  BridgedTokenSymbol,
} from '@cardstack/web-client/utils/token';
import {
  Emitter,
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/ember-shared';
import { action } from '@ember/object';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { taskFor } from 'ember-concurrency-ts';
import { UsdConvertibleSymbol } from './token-to-usd';
import { TransactionOptions } from '@cardstack/cardpay-sdk';
import { Safes } from '../resources/safes';
import { TransactionReceipt } from 'web3-core';
export default class Layer2Network
  extends Service
  implements Emitter<Layer2ChainEvent>
{
  @service declare hubAuthentication: HubAuthentication;
  strategy!: Layer2Web3Strategy;
  simpleEmitter = new SimpleEmitter();
  @reads('strategy.isInitializing') declare isInitializing: boolean;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', []) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;
  @reads('strategy.usdConverters') usdConverters!: {
    [symbol: string]: (amountInWei: string) => number;
  };
  @reads('strategy.viewSafesTask') declare viewSafesTask: TaskGenerator<Safe[]>;
  @reads('strategy.safes') declare safes: Safes;
  @reads('strategy.defaultTokenBalance') defaultTokenBalance: BN | undefined;
  @reads('strategy.defaultTokenSymbol') defaultTokenSymbol!: BridgedTokenSymbol;
  @reads('strategy.bridgedDaiTokenSymbol')
  bridgedDaiTokenSymbol!: BridgedTokenSymbol;
  @reads('strategy.bridgedCardTokenSymbol')
  bridgedCardTokenSymbol!: BridgedTokenSymbol;
  @reads('strategy.cardBalance') cardBalance: BN | undefined;
  @reads('strategy.depotSafe') depotSafe: DepotSafe | undefined;
  @reads('strategy.safes.isLoading')
  declare isFetchingDepot: boolean;
  @reads('strategy.issuePrepaidCardSpendMinValue')
  declare issuePrepaidCardSpendMinValue: number;
  @reads('strategy.issuePrepaidCardDaiMinValue')
  declare issuePrepaidCardDaiMinValue: BN;

  bridgedSymbolToWithdrawalLimits: Map<BridgedTokenSymbol, WithdrawalLimits> =
    new Map();

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer2) {
      case 'gnosis':
        this.strategy = new GnosisWeb3Strategy();
        break;
      case 'sokol':
        this.strategy = new SokolWeb3Strategy();
        break;
      case 'test':
        this.strategy = new Layer2TestWeb3Strategy();
        break;
    }

    this.strategy.on('disconnect', this.onDisconnect);
    this.strategy.on('incorrect-chain', this.onIncorrectChain);
    this.strategy.on('account-changed', this.onAccountChanged);
    this.strategy.on('websocket-disconnected', this.onWebsocketDisconnected);
    this.strategy.on('initialized', () => {
      this.simpleEmitter.emit('initialized');
    });

    taskFor(this.strategy.initializeTask)
      .perform()
      .then(() => this.storeWithdrawalLimits());
  }

  async storeWithdrawalLimits() {
    [this.bridgedDaiTokenSymbol, this.bridgedCardTokenSymbol].forEach(
      (bridgedSymbol) => {
        this.getWithdrawalLimits(bridgedSymbol).then((limits) => {
          this.bridgedSymbolToWithdrawalLimits.set(bridgedSymbol, limits);
        });
      }
    );
  }

  async updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Partial<Record<UsdConvertibleSymbol, ConversionFunction>>> {
    if (symbolsToUpdate.length === 0) {
      return {};
    }
    if (!this.walletInfo.firstAddress) {
      throw new Error(
        'Cannot fetch USD conversion without being connected to Layer 2'
      );
    }
    return this.strategy.updateUsdConverters(symbolsToUpdate);
  }

  async convertFromSpend(
    symbol: ConvertibleSymbol,
    amount: number
  ): Promise<string> {
    return await this.strategy.convertFromSpend(symbol, amount);
  }

  authenticate(): Promise<string> {
    return this.strategy.authenticate();
  }

  checkHubAuthenticationValid(authToken: string): Promise<boolean> {
    return this.strategy.checkHubAuthenticationValid(authToken);
  }

  bridgeExplorerUrl(txnHash: string) {
    return txnHash ? this.strategy.bridgeExplorerUrl(txnHash) : undefined;
  }

  @task *issuePrepaidCardTask(
    faceValue: number,
    sourceAddress: string,
    customizationDid: string,
    options: TransactionOptions
  ): any {
    let prepaidCardSafe = yield this.strategy.issuePrepaidCard(
      sourceAddress,
      faceValue,
      customizationDid,
      options
    );

    yield all([
      this.safes.updateOne(prepaidCardSafe.address),
      this.safes.updateOne(sourceAddress),
    ]);

    return prepaidCardSafe;
  }

  @task *resumeIssuePrepaidCardTransactionTask(
    txnHash: string
  ): TaskGenerator<PrepaidCardSafe> {
    let prepaidCardSafe = yield this.strategy.resumeIssuePrepaidCardTransaction(
      txnHash
    );

    yield all([
      this.safes.updateOne(prepaidCardSafe.address),
      this.safes.updateDepot(),
    ]);

    return prepaidCardSafe;
  }

  @task *fetchProfileRegistrationFeeTask(): TaskGenerator<number> {
    return yield this.strategy.fetchProfileRegistrationFee();
  }

  @task *registerProfileTask(
    prepaidCardAddress: string,
    infoDid: string,
    options: TransactionOptions
  ): any {
    let profile = yield this.strategy.registerProfile(
      prepaidCardAddress,
      infoDid,
      options
    );

    yield all([
      this.safes.updateOne(prepaidCardAddress),
      this.safes.updateOne(profile.address),
    ]);

    return profile;
  }

  @task *resumeRegisterProfileTransactionTask(
    prepaidCardAddress: string,
    txnHash: string
  ): TaskGenerator<MerchantSafe> {
    let profile = yield this.strategy.resumeRegisterProfileTransaction(txnHash);

    yield all([
      this.safes.updateOne(prepaidCardAddress),
      this.safes.updateOne(profile.address),
    ]);

    return profile;
  }

  disconnect() {
    return this.strategy.disconnect();
  }

  @action onDisconnect() {
    this.hubAuthentication.authToken = null;
    this.simpleEmitter.emit('disconnect');
  }

  @action onIncorrectChain() {
    this.simpleEmitter.emit('incorrect-chain');
  }

  @action onAccountChanged() {
    this.simpleEmitter.emit('account-changed');
  }

  @action onWebsocketDisconnected() {
    this.simpleEmitter.emit('websocket-disconnected');
  }

  on(event: Layer2ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  async getBlockConfirmation(
    blockNumber: TxnBlockNumber,
    duration?: number
  ): Promise<void> {
    return this.strategy.getBlockConfirmation(blockNumber, duration);
  }

  getBlockHeight() {
    return this.strategy.getBlockHeight();
  }

  async getWithdrawalLimits(tokenSymbol: BridgedTokenSymbol) {
    return this.strategy.getWithdrawalLimits(tokenSymbol);
  }

  async awaitBridgedToLayer2(fromBlock: BN) {
    return this.strategy.awaitBridgedToLayer2(
      fromBlock,
      this.walletInfo.firstAddress!
    );
  }

  blockExplorerUrl(txnHash: string | undefined): string | undefined {
    return txnHash ? this.strategy.blockExplorerUrl(txnHash) : undefined;
  }

  @action
  async refreshSafesAndBalances() {
    return this.strategy.refreshSafesAndBalances();
  }

  async bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgedTokenSymbol,
    amount: string,
    options: TransactionOptions
  ): Promise<TransactionReceipt> {
    return this.strategy.bridgeToLayer1(
      safeAddress,
      receiverAddress,
      tokenSymbol,
      amount,
      options
    );
  }

  async resumeBridgeToLayer1(txnHash: string) {
    return this.strategy.resumeBridgeToLayer1(txnHash);
  }

  async awaitBridgedToLayer1(fromBlock: BN, transactionHash: TransactionHash) {
    return this.strategy.awaitBridgedToLayer1(fromBlock, transactionHash);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'layer2-network': Layer2Network;
  }
}
