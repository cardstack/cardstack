import Service from '@ember/service';
import config from '../config/environment';
import { inject as service } from '@ember/service';
import { all, TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import {
  Layer2ChainEvent,
  Layer2Web3Strategy,
  TransactionHash,
  WithdrawalLimits,
} from '../utils/web3-strategies/types';
import {
  MerchantSafe,
  PrepaidCardSafe,
} from '@cardstack/cardpay-sdk/sdk/safes';
import Layer2TestWeb3Strategy from '../utils/web3-strategies/test-layer2';
import XDaiWeb3Strategy from '../utils/web3-strategies/x-dai';
import SokolWeb3Strategy from '../utils/web3-strategies/sokol';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';
import BN from 'bn.js';
import { DepotSafe, Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import {
  BridgeableSymbol,
  ConvertibleSymbol,
  ConversionFunction,
  BridgedTokenSymbol,
  bridgedSymbols,
} from '@cardstack/web-client/utils/token';
import {
  Emitter,
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';
import { action } from '@ember/object';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { taskFor } from 'ember-concurrency-ts';
import { UsdConvertibleSymbol } from './token-to-usd';
import { TransactionOptions } from '@cardstack/cardpay-sdk';
import { Safes } from '../resources/safes';
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
  @reads('strategy.cardBalance') cardBalance: BN | undefined;
  @reads('strategy.depotSafe') depotSafe: DepotSafe | undefined;
  @reads('strategy.safes.isLoading')
  declare isFetchingDepot: boolean;

  bridgedSymbolToWithdrawalLimits: Map<BridgedTokenSymbol, WithdrawalLimits> =
    new Map();

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer2) {
      case 'xdai':
        this.strategy = new XDaiWeb3Strategy();
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

    taskFor(this.strategy.initializeTask)
      .perform()
      .then(() => this.storeWithdrawalLimits());
  }

  async storeWithdrawalLimits() {
    bridgedSymbols.forEach((bridgedSymbol) => {
      this.getWithdrawalLimits(bridgedSymbol).then((limits) => {
        this.bridgedSymbolToWithdrawalLimits.set(bridgedSymbol, limits);
      });
    });
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
      this.safes.updateDepot(),
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

  @task *fetchMerchantRegistrationFeeTask(): TaskGenerator<number> {
    return yield this.strategy.fetchMerchantRegistrationFee();
  }

  @task *registerMerchantTask(
    prepaidCardAddress: string,
    infoDid: string,
    options: TransactionOptions
  ): any {
    let merchant = yield this.strategy.registerMerchant(
      prepaidCardAddress,
      infoDid,
      options
    );

    yield all([
      this.safes.updateOne(prepaidCardAddress),
      this.safes.updateOne(merchant.address),
    ]);

    return merchant;
  }

  @task *resumeRegisterMerchantTransactionTask(
    prepaidCardAddress: string,
    txnHash: string
  ): TaskGenerator<MerchantSafe> {
    let merchant = yield this.strategy.resumeRegisterMerchantTransaction(
      txnHash
    );

    yield all([
      this.safes.updateOne(prepaidCardAddress),
      this.safes.updateOne(merchant.address),
    ]);

    return merchant;
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

  on(event: Layer2ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
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

  async refreshSafesAndBalances() {
    return this.strategy.refreshSafesAndBalances();
  }

  async bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgeableSymbol,
    amount: string
  ): Promise<TransactionHash> {
    return this.strategy.bridgeToLayer1(
      safeAddress,
      receiverAddress,
      tokenSymbol,
      amount
    );
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
