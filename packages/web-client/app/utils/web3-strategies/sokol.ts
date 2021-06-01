const BRIDGE = 'https://safe-walletconnect.gnosis.io/';
import CustomStorageWalletConnect from '../wc-connector';
import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3 from 'web3';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { ChainAddress, Layer2Web3Strategy, TransactionHash } from './types';
import {
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import { IConnector } from '@walletconnect/types';
import WalletInfo from '../wallet-info';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';
import {
  networkIds,
  getConstantByNetwork,
  DepotSafe,
  IExchangeRate,
  getSDK,
} from '@cardstack/cardpay-sdk';
import { SimpleEmitter, UnbindEventListener } from '../events';

export default class SokolWeb3Strategy implements Layer2Web3Strategy {
  chainName = 'Sokol testnet';
  chainId = networkIds['sokol'];
  provider: WalletConnectProvider | undefined;

  simpleEmitter = new SimpleEmitter();

  @reads('provider.connector') connector!: IConnector;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo = new WalletInfo([], this.chainId) as WalletInfo;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked waitForAccountDeferred = defer();
  web3!: Web3;
  #exchangeRateApi!: IExchangeRate;

  constructor() {
    // super(...arguments);
    this.initialize();
  }

  async initialize() {
    this.provider = new WalletConnectProvider({
      chainId: this.chainId,
      rpc: {
        [networkIds['sokol']]: getConstantByNetwork('rpcNode', 'sokol'),
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
      if (String(chainId) !== String(networkIds['sokol'])) {
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
    this.updateWalletInfo(this.connector.accounts, this.connector.chainId);
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
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

  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
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

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async refreshBalances() {
    let raw = await this.getDefaultTokenBalance();
    this.defaultTokenBalance = new BN(String(raw ?? 0));
  }

  async getDefaultTokenBalance() {
    if (this.walletInfo.firstAddress)
      return await this.web3.eth.getBalance(
        this.walletInfo.firstAddress,
        'latest'
      );
    else return 0;
  }

  async awaitBridged(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    return tokenBridge.waitForBridgingCompleted(receiver, fromBlock.toString());
  }

  async fetchDepot(owner: ChainAddress): Promise<DepotSafe | null> {
    let safesApi = await getSDK('Safes', this.web3);
    let safes = await safesApi.view(owner);
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
    return `${getConstantByNetwork('blockExplorer', 'sokol')}/tx/${txnHash}`;
  }

  async getBlockHeight(): Promise<BN> {
    const result = await this.web3.eth.getBlockNumber();
    return new BN(result.toString());
  }
}
