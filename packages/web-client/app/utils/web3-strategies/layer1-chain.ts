import { tracked } from '@glimmer/tracking';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import * as Sentry from '@sentry/browser';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import {
  BridgeableSymbol,
  ConversionFunction,
  Layer1TokenSymbol,
  TokenContractInfo,
} from '../token';
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
  IAssets,
  ILayerOneOracle,
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
import { UsdConvertibleSymbol } from '@cardstack/web-client/services/token-to-usd';

export default abstract class Layer1ChainWeb3Strategy
  implements Layer1Web3Strategy, Emitter<Layer1ChainEvent>
{
  chainId: number;
  networkSymbol: Layer1NetworkSymbol;
  simpleEmitter = new SimpleEmitter();

  // changes with connection state
  #waitForAccountDeferred = defer<void>();
  web3: Web3 | undefined;
  #layerOneOracleApi?: ILayerOneOracle;
  #assetsApi?: IAssets;
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
  nativeTokenSymbol: string;

  constructor(networkSymbol: Layer1NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.walletInfo = new WalletInfo([]);
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
    this.connectionManager.on(
      'websocket-disconnected',
      this.onWebsocketDisconnected
    );
    this.nativeTokenSymbol = getConstantByNetwork(
      'nativeTokenSymbol',
      this.networkSymbol
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

      this.web3 = new Web3();
      await this.connectionManager.reconnect(
        this.web3,
        payload.providerId,
        payload.session
      );
    } catch (e) {
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
    await this.updateWalletInfo(accounts);
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

  @action
  private onWebsocketDisconnected() {
    this.simpleEmitter.emit('websocket-disconnected');
  }

  async reconnect() {
    try {
      let providerId = ConnectionManager.getProviderIdForChain(this.chainId);
      if (providerId !== 'wallet-connect' && providerId !== 'metamask') {
        return;
      }

      this.web3 = new Web3();
      this.#layerOneOracleApi = await getSDK('LayerOneOracle', this.web3);
      this.#assetsApi = await getSDK('Assets', this.web3);
      await this.connectionManager.reconnect(this.web3, providerId);
    } catch (e) {
      console.error('Failed to initialize connection from local storage');
      console.error(e);
      Sentry.captureException(e);
      this.cleanupConnectionState();
      ConnectionManager.removeProviderFromStorage(this.chainId);
    }
  }

  async connect(walletProvider: WalletProvider): Promise<void> {
    try {
      this.web3 = new Web3();
      this.#layerOneOracleApi = await getSDK('LayerOneOracle', this.web3);
      this.#assetsApi = await getSDK('Assets', this.web3);
      await this.connectionManager.connect(this.web3, walletProvider.id);
    } catch (e) {
      console.error(
        `Failed to create connection manager: ${walletProvider.id}`
      );
      console.error(e);
      Sentry.captureException(e);
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
    this.#layerOneOracleApi = undefined;
    this.#assetsApi = undefined;
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

  private async updateWalletInfo(accounts: string[]) {
    let newWalletInfo = new WalletInfo(accounts);
    if (this.walletInfo.isEqualTo(newWalletInfo)) {
      return;
    }

    if (this.walletInfo.firstAddress && newWalletInfo.firstAddress) {
      this.simpleEmitter.emit('account-changed');
    }

    this.walletInfo = newWalletInfo;
    if (accounts.length > 0) {
      await this.refreshBalances();
    } else {
      this.defaultTokenBalance = undefined;
      this.cardBalance = undefined;
      this.daiBalance = undefined;
    }
  }

  private clearWalletInfo() {
    this.updateWalletInfo([]);
  }

  contractForToken(symbol: BridgeableSymbol) {
    if (!this.web3)
      throw new Error('Cannot get contract for bridgeable tokens without web3');
    let { address, abi } = new TokenContractInfo(symbol, this.networkSymbol);
    return new this.web3.eth.Contract(abi, address);
  }

  async refreshBalances() {
    if (!this.isConnected) return;

    try {
      let balances = await Promise.all<string>([
        this.getDefaultTokenBalance(),
        this.getErc20Balance('DAI'),
        this.getErc20Balance('CARD'),
      ]);
      let [defaultTokenBalance, daiBalance, cardBalance] = balances;
      this.defaultTokenBalance = new BN(defaultTokenBalance);
      this.daiBalance = new BN(daiBalance);
      this.cardBalance = new BN(cardBalance);
    } catch (e) {
      // Incorrect chain id triggers controller:card-pay#onLayer2Incorrect to show a modal
      if (e.message.includes('what name the network id')) {
        // Exception being ignored: Don't know what name the network id ID is
        Sentry.captureException(e);
      }
    }
  }

  private async getErc20Balance(
    tokenSymbol: Layer1TokenSymbol
  ): Promise<string> {
    if (!this.#assetsApi) {
      throw new Error('Cannot get token balances without a web3 connection');
    }
    if (!this.walletInfo.firstAddress) {
      return '0';
    }
    let { address } = new TokenContractInfo(tokenSymbol, this.networkSymbol);

    return this.#assetsApi.getBalanceForToken(
      address,
      this.walletInfo.firstAddress
    );
  }

  private async getDefaultTokenBalance(): Promise<string> {
    if (!this.#assetsApi) {
      throw new Error('Cannot get token balances without a web3 connection');
    }
    if (!this.walletInfo.firstAddress) {
      return '0';
    }
    return this.#assetsApi.getNativeTokenBalance(this.walletInfo.firstAddress);
  }

  async approve(
    amountInWei: BN,
    tokenSymbol: BridgeableSymbol,
    { onTxnHash }: ApproveOptions
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot unlock tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.unlockTokens(
      new TokenContractInfo(tokenSymbol, this.networkSymbol).address,
      amountInWei.toString(),
      { onTxnHash }
    );
  }

  async resumeApprove(txnHash: TransactionHash): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot unlock tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.unlockTokens(txnHash);
  }

  async relayTokens(
    tokenSymbol: BridgeableSymbol,
    receiverAddress: string,
    amountInWei: BN,
    { onTxnHash }: RelayTokensOptions
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot relay tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.relayTokens(
      new TokenContractInfo(tokenSymbol, this.networkSymbol).address,
      receiverAddress,
      amountInWei.toString(),
      { onTxnHash }
    );
  }

  async resumeRelayTokens(
    txnHash: TransactionHash
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot unlock tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.relayTokens(txnHash);
  }

  async resumeClaimBridgedTokens(txnHash: string): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot claim bridged tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.claimBridgedTokens(txnHash);
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
      { onTxnHash: options?.onTxnHash }
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

  async getEstimatedGasForWithdrawalClaim(
    symbol: BridgeableSymbol
  ): Promise<BN> {
    if (!this.web3)
      throw new Error('Cannot getEstimatedGasForWithdrawalClaim without web3');

    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    let { address } = new TokenContractInfo(symbol, this.networkSymbol);
    return tokenBridge.getEstimatedGasForWithdrawalClaim(address);
  }

  async updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Record<UsdConvertibleSymbol, ConversionFunction>> {
    let layerOneOracleApi = this.#layerOneOracleApi;
    if (!layerOneOracleApi)
      throw new Error('Cannot updateUsdConverters without a web3 connection');
    let promisesHash = {} as Record<
      UsdConvertibleSymbol,
      Promise<ConversionFunction>
    >;
    for (let symbol of symbolsToUpdate) {
      promisesHash[symbol] = layerOneOracleApi.getEthToUsdConverter();
    }
    return hash(promisesHash);
  }
}
