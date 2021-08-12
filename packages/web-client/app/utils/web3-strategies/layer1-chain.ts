import { tracked } from '@glimmer/tracking';
import { defer } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import * as Sentry from '@sentry/browser';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import { BridgeableSymbol, TokenContractInfo } from '../token';
import WalletInfo from '../wallet-info';
import { WalletProvider, WalletProviderId } from '../wallet-providers';
import {
  ApproveOptions,
  Layer1ChainEvent,
  Layer1Web3Strategy,
  TransactionHash,
  TxnBlockNumber,
  Layer1NetworkSymbol,
  ClaimBridgedTokensOptions,
  RelayTokensOptions,
} from './types';
import {
  BridgeValidationResult,
  getConstantByNetwork,
  getSDK,
  networkIds,
  waitUntilBlock,
} from '@cardstack/cardpay-sdk';
import {
  ConnectionManager,
  ConnectionManagerEvent,
} from './layer-1-connection-manager';
import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { action } from '@ember/object';

export default abstract class Layer1ChainWeb3Strategy
  implements Layer1Web3Strategy, Emitter<Layer1ChainEvent> {
  chainId: number;
  networkSymbol: Layer1NetworkSymbol;
  simpleEmitter = new SimpleEmitter();

  // changes with connection state
  #waitForAccountDeferred = defer<void>();
  web3: Web3 | undefined;
  connectionManager: ConnectionManager;
  eventListenersToUnbind: {
    [event in ConnectionManagerEvent]?: UnbindEventListener;
  } = {};
  @tracked currentProviderId: string | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked walletInfo: WalletInfo;
  @tracked connectedChainId: number | undefined;
  @tracked bridgeConfirmationBlockCount: number;

  constructor(networkSymbol: Layer1NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.walletInfo = new WalletInfo([], this.chainId);
    this.networkSymbol = networkSymbol;
    this.bridgeConfirmationBlockCount = Number(
      getConstantByNetwork('ambFinalizationRate', this.networkSymbol)
    );
    this.connectionManager = new ConnectionManager(networkSymbol);
    // may need this for testing?
    this.connectionManager.on('connected', this.onConnect);
    this.connectionManager.on('disconnected', this.onDisconnect);
    this.connectionManager.on('chain-changed', this.onChainChanged);
    this.connectionManager.on(
      'cross-tab-connection',
      this.onCrossTabConnection
    );
    taskFor(this.initializeTask).perform();
  }

  get isInitializing() {
    return taskFor(this.initializeTask).isRunning;
  }

  @task *initializeTask() {
    yield this.reconnect();
  }

  @action
  async onCrossTabConnection(payload: {
    providerId: WalletProviderId;
    session?: any;
  }) {
    try {
      if (
        payload.providerId !== 'wallet-connect' &&
        payload.providerId !== 'metamask'
      ) {
        return;
      }

      await this.connectionManager.setup(payload.providerId, payload.session);

      if (this.connectionManager.provider) {
        this.web3 = new Web3();
        this.web3.setProvider(this.connectionManager.provider);
        await this.connectionManager.reconnect(); // use the reconnect method because of edge cases
      }
    } catch (e) {
      // we might want to get the user to reload the page here
      console.error(
        `Failed to establish connection to ${payload.providerId} from cross-tab communication`
      );
      console.error(e);
      Sentry.captureException(e);
      this.cleanupConnectionState();
    }
  }

  @action
  async onConnect(accounts: string[]) {
    this.updateWalletInfo(accounts, this.chainId);
    this.currentProviderId = this.connectionManager?.providerId;
    this.#waitForAccountDeferred.resolve();
  }

  @action
  onChainChanged(chainId: number) {
    this.connectedChainId = chainId;
    if (this.connectedChainId !== this.chainId) {
      this.simpleEmitter.emit('incorrect-chain');
    } else {
      this.simpleEmitter.emit('correct-chain');
    }
  }

  @action
  private onDisconnect() {
    if (this.isConnected) {
      this.simpleEmitter.emit('disconnect');
    }
    this.cleanupConnectionState();
  }

  async reconnect() {
    try {
      let providerId = ConnectionManager.getProviderIdForChain(this.chainId);
      if (providerId !== 'wallet-connect' && providerId !== 'metamask') {
        return;
      }

      await this.connectionManager.setup(providerId);

      if (this.connectionManager.provider) {
        this.web3 = new Web3();
        this.web3.setProvider(this.connectionManager.provider);
        await this.connectionManager.reconnect(); // use the reconnect method because of edge cases
      }
    } catch (e) {
      console.error('Failed to initialize connection from local storage');
      console.error(e);
      this.cleanupConnectionState();
      ConnectionManager.removeProviderFromStorage(this.chainId);
    }
  }

  async connect(walletProvider: WalletProvider): Promise<void> {
    try {
      await this.connectionManager.setup(walletProvider.id);

      if (this.connectionManager.provider) {
        this.web3 = new Web3();
        this.web3.setProvider(this.connectionManager.provider);
        await this.connectionManager.connect();
      }
    } catch (e) {
      console.error(
        `Failed to create connection manager: ${walletProvider.id}`
      );
      console.error(e);
      this.cleanupConnectionState();
      ConnectionManager.removeProviderFromStorage(this.chainId);
    }
  }

  async disconnect(): Promise<void> {
    return this.connectionManager?.disconnect();
  }

  cleanupConnectionState() {
    this.clearWalletInfo();
    Object.entries(this.eventListenersToUnbind).forEach(
      ([event, unbind]: [ConnectionManagerEvent, UnbindEventListener]) => {
        unbind();
        delete this.eventListenersToUnbind[event];
      }
    );
    this.connectionManager?.reset();
    this.web3 = undefined;
    this.currentProviderId = '';
    this.connectedChainId = undefined;
    this.#waitForAccountDeferred = defer();
  }

  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }

  on(event: Layer1ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  private updateWalletInfo(accounts: string[], chainId: number) {
    this.walletInfo = new WalletInfo(accounts, chainId);
    if (accounts.length > 0) {
      this.refreshBalances();
    } else {
      this.defaultTokenBalance = undefined;
      this.cardBalance = undefined;
      this.daiBalance = undefined;
    }
  }

  private clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }

  contractForToken(symbol: BridgeableSymbol) {
    if (!this.web3)
      throw new Error('Cannot get contract for bridgeable tokens without web3');
    let { address, abi } = new TokenContractInfo(symbol, this.networkSymbol);
    return new this.web3.eth.Contract(abi, address);
  }

  async refreshBalances() {
    let balances = await Promise.all<string>([
      this.getDefaultTokenBalance(),
      this.getErc20Balance(this.contractForToken('DAI')),
      this.getErc20Balance(this.contractForToken('CARD')),
    ]);
    let [defaultTokenBalance, daiBalance, cardBalance] = balances;
    this.defaultTokenBalance = new BN(defaultTokenBalance);
    this.daiBalance = new BN(daiBalance);
    this.cardBalance = new BN(cardBalance);
  }

  private getErc20Balance(contract: Contract) {
    return contract.methods.balanceOf(this.walletInfo.firstAddress).call();
  }

  private async getDefaultTokenBalance() {
    if (!this.web3) throw new Error('Cannot get token balances without web3');
    if (this.walletInfo.firstAddress)
      return await this.web3.eth.getBalance(
        this.walletInfo.firstAddress,
        'latest'
      );
    else return 0;
  }

  async approve(
    amountInWei: BN,
    tokenSymbol: BridgeableSymbol,
    { onTxHash }: ApproveOptions
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot unlock tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.unlockTokens(
      new TokenContractInfo(tokenSymbol, this.networkSymbol).address,
      amountInWei.toString(),
      onTxHash
    );
  }

  async relayTokens(
    tokenSymbol: BridgeableSymbol,
    receiverAddress: string,
    amountInWei: BN,
    { onTxHash }: RelayTokensOptions
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot relay tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.relayTokens(
      new TokenContractInfo(tokenSymbol, this.networkSymbol).address,
      receiverAddress,
      amountInWei.toString(),
      onTxHash
    );
  }

  async claimBridgedTokens(
    bridgeValidationResult: BridgeValidationResult,
    options?: ClaimBridgedTokensOptions
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot claim bridged tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.claimBridgedTokens(
      bridgeValidationResult.messageId,
      bridgeValidationResult.encodedData,
      bridgeValidationResult.signatures,
      options?.onTxHash
    );
  }

  async getBlockConfirmation(blockNumber: TxnBlockNumber): Promise<void> {
    if (!this.web3)
      throw new Error('Cannot get block confirmations without web3');
    return await waitUntilBlock(this.web3, blockNumber);
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'blockExplorer',
      this.networkSymbol
    )}/tx/${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'bridgeExplorer',
      this.networkSymbol
    )}/${txnHash}`;
  }
}
