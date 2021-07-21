import Service from '@ember/service';
import config from '../config/environment';
import {
  Layer1ChainEvent,
  Layer1Web3Strategy,
} from '../utils/web3-strategies/types';
import Layer1TestWeb3Strategy from '../utils/web3-strategies/test-layer1';
import EthWeb3Strategy from '../utils/web3-strategies/ethereum';
import KovanWeb3Strategy from '../utils/web3-strategies/kovan';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';
import { task } from 'ember-concurrency-decorators';
import { WalletProvider } from '../utils/wallet-providers';
import { TransactionReceipt } from 'web3-core';
import BN from 'bn.js';
import {
  Emitter,
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';
import { action } from '@ember/object';
import { TaskGenerator } from 'ember-concurrency';
export default class Layer1Network
  extends Service
  implements Emitter<Layer1ChainEvent> {
  strategy!: Layer1Web3Strategy;
  simpleEmitter = new SimpleEmitter();
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', new WalletInfo([], -1)) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;
  @reads('strategy.defaultTokenBalance') defaultTokenBalance: BN | undefined;
  @reads('strategy.daiBalance') daiBalance: BN | undefined;
  @reads('strategy.cardBalance') cardBalance: BN | undefined;

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

  // basically only allow re-emitting of events from the strategy
  on(event: Layer1ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  @task *approve(
    amount: BN,
    tokenSymbol: string
  ): TaskGenerator<TransactionReceipt> {
    let txnReceipt = yield this.strategy.approve(amount, tokenSymbol);
    return txnReceipt;
  }

  @task *relayTokens(
    tokenSymbol: string,
    destinationAddress: string,
    amount: BN
  ): TaskGenerator<TransactionReceipt> {
    let txnReceipt = yield this.strategy.relayTokens(
      tokenSymbol,
      destinationAddress,
      amount
    );
    yield this.strategy.refreshBalances();
    return txnReceipt;
  }

  blockExplorerUrl(txnHash: string | undefined): string | undefined {
    return txnHash ? this.strategy.blockExplorerUrl(txnHash) : undefined;
  }

  bridgeExplorerUrl(txnHash: string) {
    return txnHash ? this.strategy.bridgeExplorerUrl(txnHash) : undefined;
  }

  async awaitBridged(fromBlock: BN) {
    return this.strategy.awaitBridged(fromBlock, this.walletInfo.firstAddress!);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'layer1-network': Layer1Network;
  }
}
