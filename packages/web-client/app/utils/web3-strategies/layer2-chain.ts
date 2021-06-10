import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { IConnector } from '@walletconnect/types';
import WalletConnectProvider from '@walletconnect/web3-provider';

import { SimpleEmitter, UnbindEventListener } from '../events';
import { ConvertibleSymbol, ConversionFunction, NetworkSymbol } from '../token';
import WalletInfo from '../wallet-info';
import CustomStorageWalletConnect from '../wc-connector';
import { ChainAddress, Layer2Web3Strategy, TransactionHash } from './types';
import {
  networkIds,
  getConstantByNetwork,
  DepotSafe,
  IExchangeRate,
  ISafes,
  getSDK,
} from '@cardstack/cardpay-sdk';

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export default abstract class Layer2ChainWeb3Strategy
  implements Layer2Web3Strategy {
  chainName: string;
  chainId: number;
  networkSymbol: NetworkSymbol;
  provider: WalletConnectProvider | undefined;

  simpleEmitter = new SimpleEmitter();

  web3!: Web3;
  #exchangeRateApi!: IExchangeRate;
  #safesApi!: ISafes;

  @tracked walletInfo: WalletInfo;
  @tracked walletConnectUri: string | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked waitForAccountDeferred = defer();

  @reads('provider.connector') connector!: IConnector;

  constructor(networkSymbol: NetworkSymbol, chainName: string) {
    this.chainName = chainName;
    this.chainId = networkIds[networkSymbol];
    this.networkSymbol = networkSymbol;
    this.walletInfo = new WalletInfo([], this.chainId);

    this.initialize();
  }

  async initialize() {
    this.provider = new WalletConnectProvider({
      chainId: this.chainId,
      rpc: {
        [networkIds[this.networkSymbol]]: getConstantByNetwork(
          'rpcNode',
          this.networkSymbol
        ),
      },
      connector: new CustomStorageWalletConnect(
        {
          bridge: BRIDGE,
        },
        this.chainId
      ),
    });
    this.connector.on('display_uri', (err, payload) => {
      if (err) {
        console.error('Error in display_uri callback', err);
        return;
      }
      this.walletConnectUri = payload.params[0];
    });
    let strategy = this;
    this.provider.on('chainChanged', (chainId: number) => {
      if (String(chainId) !== String(networkIds[this.networkSymbol])) {
        console.log(`Layer2 WC chainChanged to ${chainId}. Disconnecting`);
        strategy.disconnect();
      }
    });
    this.connector.on('session_update', (error, payload) => {
      if (error) {
        throw error;
      }
      let { accounts, chainId } = payload.params[0];
      if (chainId !== this.chainId) {
        throw new Error(
          `Expected connection on ${this.chainName} (chain ID ${this.chainId}) but connected to chain ID ${chainId}`
        );
      }
      this.updateWalletInfo(accounts, chainId);
    });

    this.connector.on('disconnect', (error) => {
      if (error) {
        console.error('error disconnecting', error);
        throw error;
      }
      this.onDisconnect();
    });
    await this.provider.enable();
    this.web3 = new Web3(this.provider as any);
    this.#exchangeRateApi = await getSDK('ExchangeRate', this.web3);
    this.#safesApi = await getSDK('Safes', this.web3);
    this.updateWalletInfo(this.connector.accounts, this.connector.chainId);
  }

  updateWalletInfo(accounts: string[], chainId: number) {
    let newWalletInfo = new WalletInfo(accounts, chainId);
    if (this.walletInfo.isEqualTo(newWalletInfo)) {
      return;
    }
    this.walletInfo = newWalletInfo;
    if (accounts.length) {
      this.refreshBalances();
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], this.chainId);
  }

  private async refreshBalances() {
    let raw = await this.getDefaultTokenBalance();
    this.defaultTokenBalance = new BN(String(raw ?? 0));
  }

  // unlike layer 1 with metamask, there is no necessity for cross-tab communication
  // about disconnecting. WalletConnect's disconnect event tells all tabs that you are disconnected
  onDisconnect() {
    if (this.isConnected) {
      this.clearWalletInfo();
      this.walletConnectUri = undefined;
      this.simpleEmitter.emit('disconnect');
      setTimeout(() => {
        console.log('initializing');
        this.initialize();
      }, 1000);
    }
  }

  async getDefaultTokenBalance() {
    if (this.walletInfo.firstAddress)
      return await this.web3.eth.getBalance(
        this.walletInfo.firstAddress,
        'latest'
      );
    else return 0;
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }

  async updateUsdConverters(
    symbolsToUpdate: ConvertibleSymbol[]
  ): Promise<Record<ConvertibleSymbol, ConversionFunction>> {
    let promisesHash = {} as Record<
      ConvertibleSymbol,
      Promise<ConversionFunction>
    >;
    for (let symbol of symbolsToUpdate) {
      promisesHash[symbol] = this.#exchangeRateApi.getUSDConverter(symbol);
    }
    return hash(promisesHash);
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'blockExplorer',
      this.networkSymbol
    )}/tx/${txnHash}`;
  }

  async getBlockHeight(): Promise<BN> {
    const result = await this.web3.eth.getBlockNumber();
    return new BN(result.toString());
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async awaitBridged(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    return tokenBridge.waitForBridgingCompleted(receiver, fromBlock.toString());
  }

  async fetchDepot(owner: ChainAddress): Promise<DepotSafe | null> {
    let safes = await this.#safesApi.view(owner);
    let depotSafes = safes.filter(
      (safe) => safe.type === 'depot'
    ) as DepotSafe[];
    if (depotSafes.length) {
      return depotSafes[depotSafes.length - 1];
    }
    return null;
  }

  async disconnect(): Promise<void> {
    await this.provider?.disconnect();
  }
  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }
}
