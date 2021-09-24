import Service from '@ember/service';
import config from '../config/environment';
import {
  ClaimBridgedTokensOptions,
  Layer1ChainEvent,
  Layer1Web3Strategy,
  TransactionHash,
  TxnBlockNumber,
} from '../utils/web3-strategies/types';
import Layer1TestWeb3Strategy from '../utils/web3-strategies/test-layer1';
import EthWeb3Strategy from '../utils/web3-strategies/ethereum';
import KovanWeb3Strategy from '../utils/web3-strategies/kovan';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';
import { task } from 'ember-concurrency-decorators';
import { TransactionReceipt } from 'web3-core';
import BN from 'bn.js';
import {
  Emitter,
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';
import { action } from '@ember/object';
import { TaskGenerator } from 'ember-concurrency';
import { BridgeValidationResult } from '@cardstack/cardpay-sdk';
import walletProviders, {
  WalletProvider,
} from '@cardstack/web-client/utils/wallet-providers';
import { BridgeableSymbol, ConversionFunction } from '../utils/token';
import { UsdConvertibleSymbol } from './token-to-usd';

export default class Layer1Network
  extends Service
  implements Emitter<Layer1ChainEvent>
{
  strategy!: Layer1Web3Strategy;
  simpleEmitter = new SimpleEmitter();
  walletProviders = walletProviders;
  @reads('strategy.isInitializing') declare isInitializing: boolean;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', new WalletInfo([])) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;
  @reads('strategy.defaultTokenBalance') defaultTokenBalance: BN | undefined;
  @reads('strategy.daiBalance') daiBalance: BN | undefined;
  @reads('strategy.cardBalance') cardBalance: BN | undefined;
  @reads('strategy.nativeTokenSymbol') nativeTokenSymbol: string | undefined;

  getEstimatedGasForWithdrawalClaim(symbol: BridgeableSymbol): Promise<BN> {
    return this.strategy.getEstimatedGasForWithdrawalClaim(symbol);
  }

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer1) {
      case 'keth':
        this.strategy = new KovanWeb3Strategy();
        break;
      case 'eth':
        this.strategy = new EthWeb3Strategy();
        break;
      case 'test':
        this.strategy = new Layer1TestWeb3Strategy();
        break;
    }

    this.strategy.on('disconnect', this.onDisconnect);
    this.strategy.on('account-changed', this.onAccountChanged);
    this.strategy.on('incorrect-chain', this.onIncorrectChain);
    this.strategy.on('correct-chain', this.onCorrectChain);
  }

  connect(walletProvider: WalletProvider) {
    this.strategy.connect(walletProvider);
    return this.waitForAccount;
  }

  disconnect() {
    this.strategy.disconnect();
  }

  @action onDisconnect() {
    this.simpleEmitter.emit('disconnect');
  }

  @action onIncorrectChain() {
    this.simpleEmitter.emit('incorrect-chain');
  }

  @action onCorrectChain() {
    this.simpleEmitter.emit('correct-chain');
  }

  @action onAccountChanged() {
    this.simpleEmitter.emit('account-changed');
  }

  // basically only allow re-emitting of events from the strategy
  on(event: Layer1ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  @task *approveTask(
    amount: BN,
    tokenSymbol: string,
    onTxnHash: (txnHash: TransactionHash) => void
  ): TaskGenerator<TransactionReceipt> {
    let txnReceipt = yield this.strategy.approve(amount, tokenSymbol, {
      onTxnHash,
    });
    return txnReceipt;
  }

  async resumeApprove(txnHash: TransactionHash) {
    return this.strategy.resumeApprove(txnHash);
  }

  @task *relayTokensTask(
    tokenSymbol: string,
    destinationAddress: string,
    amount: BN,
    onTxnHash: (txnHash: TransactionHash) => void
  ): TaskGenerator<TransactionReceipt> {
    let txnReceipt = yield this.strategy.relayTokens(
      tokenSymbol,
      destinationAddress,
      amount,
      { onTxnHash }
    );
    yield this.strategy.refreshBalances();
    return txnReceipt;
  }

  async resumeRelayTokens(txnHash: TransactionHash) {
    return this.strategy.resumeRelayTokens(txnHash);
  }

  blockExplorerUrl(txnHash: string | undefined): string | undefined {
    return txnHash ? this.strategy.blockExplorerUrl(txnHash) : undefined;
  }

  bridgeExplorerUrl(txnHash: string) {
    return txnHash ? this.strategy.bridgeExplorerUrl(txnHash) : undefined;
  }

  @task *resumeClaimBridgedTokensTask(
    txnHash: string
  ): TaskGenerator<TransactionReceipt> {
    let result = yield this.strategy.resumeClaimBridgedTokens(txnHash);
    return result;
  }

  @task *claimBridgedTokensTask(
    bridgeValidationResult: BridgeValidationResult,
    options?: ClaimBridgedTokensOptions
  ): TaskGenerator<TransactionReceipt> {
    let result = yield this.strategy.claimBridgedTokens(
      bridgeValidationResult,
      options
    );
    yield this.strategy.refreshBalances();
    return result;
  }

  async updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Partial<Record<UsdConvertibleSymbol, ConversionFunction>>> {
    if (symbolsToUpdate.length === 0) {
      return {};
    }
    if (!this.walletInfo.firstAddress) {
      throw new Error(
        'Cannot fetch USD conversion without being connected to Layer 1'
      );
    }
    return this.strategy.updateUsdConverters(symbolsToUpdate);
  }

  getBlockConfirmation(blockNumber: TxnBlockNumber) {
    return this.strategy.getBlockConfirmation(blockNumber);
  }

  get walletProvider(): WalletProvider | undefined {
    return this.walletProviders.find(
      (w) => w.id === this.strategy.currentProviderId
    );
  }

  refreshBalances() {
    return this.strategy.refreshBalances();
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'layer1-network': Layer1Network;
  }
}
