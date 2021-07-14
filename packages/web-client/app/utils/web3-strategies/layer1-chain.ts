import { tracked } from '@glimmer/tracking';
import { defer } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { Contract } from 'web3-eth-contract';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import { BridgeableSymbol, TokenContractInfo } from '../token';
import WalletInfo from '../wallet-info';
import { WalletProvider } from '../wallet-providers';
import {
  Layer1ChainEvent,
  Layer1Web3Strategy,
  TransactionHash,
  Layer1NetworkSymbol,
} from './types';
import {
  getConstantByNetwork,
  getSDK,
  networkIds,
} from '@cardstack/cardpay-sdk';
import {
  ConnectionManager,
  ConnectionManagerEvent,
} from './layer-1-connection-manager';

export default abstract class Layer1ChainWeb3Strategy
  implements Layer1Web3Strategy, Emitter<Layer1ChainEvent> {
  chainId: number;
  networkSymbol: Layer1NetworkSymbol;
  simpleEmitter = new SimpleEmitter();

  // changes with connection state
  #waitForAccountDeferred = defer<void>();
  web3: Web3 | undefined;
  connectionManager: ConnectionManager | undefined;
  eventListenersToUnbind: {
    [event in ConnectionManagerEvent]?: UnbindEventListener;
  } = {};
  @tracked currentProviderId: string | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked walletInfo: WalletInfo;
  @tracked connectedChainId: number | undefined;

  constructor(networkSymbol: Layer1NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.walletInfo = new WalletInfo([], this.chainId);
    this.networkSymbol = networkSymbol;
    this.initialize();
  }

  async initialize() {
    try {
      let web3 = new Web3();
      let providerId = ConnectionManager.getProviderIdForChain(this.chainId);
      if (providerId !== 'wallet-connect' && providerId !== 'metamask') {
        return;
      }

      let connectionManager: ConnectionManager = ConnectionManager.create(
        providerId,
        {
          networkSymbol: this.networkSymbol,
          chainId: this.chainId,
        }
      );

      this.eventListenersToUnbind.connected = connectionManager.on(
        'connected',
        this.onConnect.bind(this)
      );
      this.eventListenersToUnbind.disconnected = connectionManager.on(
        'disconnected',
        this.onDisconnect.bind(this)
      );
      this.eventListenersToUnbind['chain-changed'] = connectionManager.on(
        'chain-changed',
        this.onChainChanged.bind(this)
      );

      await connectionManager.setup(web3);

      if (connectionManager) {
        this.web3 = web3;
        this.connectionManager = connectionManager;
        await connectionManager.reconnect(); // use the reconnect method because of edge cases
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
      let web3 = new Web3();
      let connectionManager: ConnectionManager = ConnectionManager.create(
        walletProvider.id,
        {
          networkSymbol: this.networkSymbol,
          chainId: this.chainId,
        }
      );
      this.eventListenersToUnbind.connected = connectionManager.on(
        'connected',
        this.onConnect.bind(this)
      );
      this.eventListenersToUnbind.disconnected = connectionManager.on(
        'disconnected',
        this.onDisconnect.bind(this)
      );
      this.eventListenersToUnbind['chain-changed'] = connectionManager.on(
        'chain-changed',
        this.onChainChanged.bind(this)
      );

      await connectionManager.setup(web3);

      this.web3 = web3;
      this.connectionManager = connectionManager;
      await connectionManager.connect();
    } catch (e) {
      console.error(
        `Failed to create connection manager: ${walletProvider.id}`
      );
      console.error(e);
      this.cleanupConnectionState();
      ConnectionManager.removeProviderFromStorage(this.chainId);
    }
  }

  async onConnect(accounts: string[]) {
    this.updateWalletInfo(accounts, this.chainId);
    this.currentProviderId = this.connectionManager?.providerId;
    this.#waitForAccountDeferred.resolve();
  }

  onChainChanged(chainId: number) {
    this.connectedChainId = chainId;
    if (this.connectedChainId !== this.chainId) {
      this.simpleEmitter.emit('incorrect-chain');
    } else {
      this.simpleEmitter.emit('correct-chain');
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
    this.connectionManager?.destroy();
    this.connectionManager = undefined;
    this.web3 = undefined;
    this.currentProviderId = '';
    this.connectedChainId = undefined;
    this.#waitForAccountDeferred = defer();
  }

  private onDisconnect() {
    if (this.isConnected) {
      this.simpleEmitter.emit('disconnect');
    }
    this.cleanupConnectionState();
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
    tokenSymbol: BridgeableSymbol
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot unlock tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.unlockTokens(
      new TokenContractInfo(tokenSymbol, this.networkSymbol).address,
      amountInWei.toString()
    );
  }

  async relayTokens(
    tokenSymbol: BridgeableSymbol,
    receiverAddress: string,
    amountInWei: BN
  ): Promise<TransactionReceipt> {
    if (!this.web3) throw new Error('Cannot relay tokens without web3');
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    return tokenBridge.relayTokens(
      new TokenContractInfo(tokenSymbol, this.networkSymbol).address,
      receiverAddress,
      amountInWei.toString()
    );
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
