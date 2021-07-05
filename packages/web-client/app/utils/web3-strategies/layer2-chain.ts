import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { IConnector } from '@walletconnect/types';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { task } from 'ember-concurrency-decorators';

import { SimpleEmitter, UnbindEventListener } from '../events';
import {
  ConvertibleSymbol,
  ConversionFunction,
  NetworkSymbol,
  TokenContractInfo,
} from '../token';
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
import { taskFor } from 'ember-concurrency-ts';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export default abstract class Layer2ChainWeb3Strategy
  implements Layer2Web3Strategy {
  chainName: string;
  chainId: number;
  networkSymbol: NetworkSymbol;
  provider: WalletConnectProvider | undefined;
  simpleEmitter = new SimpleEmitter();
  defaultTokenSymbol: ConvertibleSymbol = 'DAI';
  defaultTokenContractAddress?: string;
  web3: Web3 = new Web3();
  #exchangeRateApi!: IExchangeRate;
  #safesApi!: ISafes;
  @tracked depotSafe: DepotSafe | null = null;
  @tracked walletInfo: WalletInfo;
  @tracked walletConnectUri: string | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked waitForAccountDeferred = defer();

  @reads('provider.connector') connector!: IConnector;

  get isFetchingDepot() {
    return taskFor(this.fetchDepotTask).isRunning;
  }

  constructor(networkSymbol: NetworkSymbol, chainName: string) {
    this.chainName = chainName;
    this.chainId = networkIds[networkSymbol];
    this.networkSymbol = networkSymbol;
    this.walletInfo = new WalletInfo([], this.chainId);
    let defaultTokenContractInfo = this.getTokenContractInfo(
      this.defaultTokenSymbol,
      networkSymbol
    );
    this.defaultTokenContractAddress = defaultTokenContractInfo.address;

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
    this.connector.on('session_update', async (error, payload) => {
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
    this.web3.setProvider(this.provider as any);
    this.#exchangeRateApi = await getSDK('ExchangeRate', this.web3);
    this.#safesApi = await getSDK('Safes', this.web3);
    this.updateWalletInfo(this.connector.accounts, this.connector.chainId);
  }

  private getTokenContractInfo(
    symbol: ConvertibleSymbol,
    network: NetworkSymbol
  ): TokenContractInfo {
    return new TokenContractInfo(symbol, network);
  }

  async updateWalletInfo(accounts: string[], chainId: number) {
    let newWalletInfo = new WalletInfo(accounts, chainId);
    if (this.walletInfo.isEqualTo(newWalletInfo)) {
      return;
    }
    this.walletInfo = newWalletInfo;
    if (accounts.length) {
      taskFor(this.fetchDepotTask).perform();

      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], this.chainId);
  }

  async refreshBalances() {
    return taskFor(this.fetchDepotTask).perform();
  }

  async issuePrepaidCard(safeAddress: string, amount: number): Promise<String> {
    const PrepaidCard = await getSDK('PrepaidCard', this.web3);

    try {
      const result = await PrepaidCard.create(
        safeAddress,
        this.defaultTokenContractAddress!,
        [amount],
        undefined
      );

      return Promise.resolve(result.prepaidCardAddresses[0]);
    } catch (e) {
      console.log('prepaid card create error', e);
      return Promise.reject(e);
    }
  }

  // unlike layer 1 with metamask, there is no necessity for cross-tab communication
  // about disconnecting. WalletConnect's disconnect event tells all tabs that you are disconnected
  onDisconnect() {
    if (this.isConnected) {
      this.depotSafe = null;
      this.clearWalletInfo();
      this.walletConnectUri = undefined;
      this.simpleEmitter.emit('disconnect');
    }

    // we always want to re-generate the uri, because the 'disconnect' event from WalletConnect
    // covers clicking the 'cancel' button in the wallet/mobile app
    // if we don't re-generate the uri, then users might be stuck with the old one that cannot
    // scan/fails silently
    setTimeout(() => {
      console.log('initializing');
      this.initialize();
    }, 500);
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

  @task *fetchDepotTask(): any {
    let depot = null;

    if (this.walletInfo.firstAddress) {
      let safes = yield this.#safesApi.view(this.walletInfo.firstAddress);
      let depotSafes = safes.filter(
        (safe: Safe) => safe.type === 'depot'
      ) as DepotSafe[];

      depot = depotSafes[depotSafes.length - 1] ?? null;
      if (depot) {
        let defaultBalance = depot.tokens.find(
          (tokenInfo) => tokenInfo.token.symbol === this.defaultTokenSymbol
        )?.balance;
        let cardBalance = depot.tokens.find(
          (tokenInfo) => tokenInfo.token.symbol === 'CARD'
        )?.balance;
        this.defaultTokenBalance = new BN(defaultBalance ?? '0');
        this.cardBalance = new BN(cardBalance ?? '0');
      } else {
        this.defaultTokenBalance = new BN('0');
        this.cardBalance = new BN('0');
      }
    }

    this.depotSafe = depot;
    return;
  }

  async convertFromSpend(symbol: ConvertibleSymbol, amount: number) {
    let address: string | undefined;
    if (symbol === this.defaultTokenSymbol) {
      address = this.defaultTokenContractAddress;
    } else {
      let tokenContractInfo = this.getTokenContractInfo(
        symbol,
        this.networkSymbol
      );
      address = tokenContractInfo.address;
    }

    if (!address) {
      return '0';
    }

    return await this.#exchangeRateApi.convertFromSpend(address, amount);
  }

  async disconnect(): Promise<void> {
    await this.provider?.disconnect();
  }
  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }
}
