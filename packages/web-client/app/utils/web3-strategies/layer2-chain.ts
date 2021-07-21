import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { IConnector } from '@walletconnect/types';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { task } from 'ember-concurrency-decorators';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import {
  BridgeableSymbol,
  ConvertibleSymbol,
  ConversionFunction,
  TokenContractInfo,
} from '../token';
import WalletInfo from '../wallet-info';
import CustomStorageWalletConnect from '../wc-connector';
import {
  ChainAddress,
  Layer2Web3Strategy,
  TransactionHash,
  Layer2NetworkSymbol,
  Layer2ChainEvent,
  IssuePrepaidCardOptions,
} from './types';
import {
  networkIds,
  getConstantByNetwork,
  getSDK,
  BridgeValidationResult,
  DepotSafe,
  Safe,
  IExchangeRate,
  IHubAuth,
  ISafes,
  PrepaidCardSafe,
} from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import config from '../../config/environment';

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export default abstract class Layer2ChainWeb3Strategy
  implements Layer2Web3Strategy, Emitter<Layer2ChainEvent> {
  chainId: number;
  networkSymbol: Layer2NetworkSymbol;
  provider: WalletConnectProvider | undefined;
  simpleEmitter = new SimpleEmitter();
  defaultTokenSymbol: ConvertibleSymbol = 'DAI';
  defaultTokenContractAddress?: string;
  web3!: Web3;
  #exchangeRateApi!: IExchangeRate;
  #safesApi!: ISafes;
  #hubAuthApi!: IHubAuth;
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

  constructor(networkSymbol: Layer2NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.networkSymbol = networkSymbol;
    this.walletInfo = new WalletInfo([], this.chainId);
    let defaultTokenContractInfo = this.getTokenContractInfo(
      this.defaultTokenSymbol,
      networkSymbol
    );
    this.defaultTokenContractAddress = defaultTokenContractInfo.address;
  }

  async initialize() {
    this.web3 = new Web3();
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
    this.web3.setProvider(this.provider as any);

    this.connector.on('display_uri', (err, payload) => {
      if (err) {
        console.error('Error in display_uri callback', err);
        return;
      }
      this.walletConnectUri = payload.params[0];
    });

    this.provider.on('accountsChanged', async (accounts: string[]) => {
      // this actually doesn't ever happen with walletconnect. we instead go through the disconnect event
      // added just-in-case
      if (!accounts.length) {
        this.onDisconnect();
      }

      try {
        // try to initialize things safely
        // one expected failure is if we connect to a chain which we don't have an rpc url for
        this.#exchangeRateApi = await getSDK('ExchangeRate', this.web3);
        this.#safesApi = await getSDK('Safes', this.web3);
        this.#hubAuthApi = await getSDK('HubAuth', this.web3, config.hubURL);
        this.updateWalletInfo(accounts, this.chainId);
      } catch (e) {
        console.error(
          'Error initializing layer 2 wallet and services. Wallet may be connected to an unsupported chain'
        );
        console.error(e);
        this.disconnect();
      }
    });

    this.provider.on('chainChanged', async (connectedChainId: number) => {
      if (connectedChainId !== this.chainId) {
        this.simpleEmitter.emit('incorrect-chain');
        this.disconnect();
      } else {
        this.simpleEmitter.emit('correct-chain');
      }
    });

    this.connector.on('disconnect', (error) => {
      if (error) {
        console.error('error disconnecting', error);
        throw error;
      }
      this.onDisconnect();
    });
    await this.provider.enable();
  }

  private getTokenContractInfo(
    symbol: ConvertibleSymbol,
    network: Layer2NetworkSymbol
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
      taskFor(this.fetchDepotTask)
        .perform()
        .then(() => {
          this.waitForAccountDeferred.resolve();
        });
    } else {
      this.defaultTokenBalance = new BN('0');
      this.cardBalance = new BN('0');
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], this.chainId);
  }

  async refreshBalances() {
    return taskFor(this.fetchDepotTask).perform();
  }

  async viewSafes(account: string): Promise<Safe[]> {
    return await this.#safesApi.view(account);
  }

  async issuePrepaidCard(
    safeAddress: string,
    amount: number,
    customizationDid: string,
    options: IssuePrepaidCardOptions
  ): Promise<PrepaidCardSafe> {
    const PrepaidCard = await getSDK('PrepaidCard', this.web3);

    const result = await PrepaidCard.create(
      safeAddress,
      this.defaultTokenContractAddress!,
      [amount],
      customizationDid,
      undefined,
      options.onTxHash
    );

    return result.prepaidCards[0];
  }

  // unlike layer 1 with metamask, there is no necessity for cross-tab communication
  // about disconnecting. WalletConnect's disconnect event tells all tabs that you are disconnected
  onDisconnect() {
    this.depotSafe = null;
    this.clearWalletInfo();
    this.walletConnectUri = undefined;

    this.simpleEmitter.emit('disconnect');

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

  async awaitBridgedToLayer2(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    return tokenBridge.waitForBridgingToLayer2Completed(
      receiver,
      fromBlock.toString()
    );
  }

  async bridgeToLayer1(
    safeAddress: string,
    tokenSymbol: BridgeableSymbol,
    amountInWei: string
  ): Promise<TransactionHash> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    let tokenAddress = new TokenContractInfo(tokenSymbol, this.networkSymbol)!
      .address;
    let receiverAddress = this.walletInfo.firstAddress!;

    let result = await tokenBridge.relayTokens(
      safeAddress,
      tokenAddress,
      receiverAddress,
      amountInWei
    );
    return result.ethereumTx.txHash;
  }

  async awaitBridgedToLayer1(
    fromBlock: BN,
    txnHash: TransactionHash
  ): Promise<BridgeValidationResult> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    return tokenBridge.waitForBridgingValidation(fromBlock.toString(), txnHash);
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

  async authenticate(): Promise<string> {
    return this.#hubAuthApi.authenticate();
  }

  async disconnect(): Promise<void> {
    await this.provider?.disconnect();
  }

  on(event: Layer2ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'bridgeExplorer',
      this.networkSymbol
    )}/${txnHash}`;
  }
}
