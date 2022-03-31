import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { IConnector } from '@walletconnect/types';
import WalletConnectProvider from '@cardstack/wc-provider';
import { task } from 'ember-concurrency-decorators';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import {
  ConvertibleSymbol,
  ConversionFunction,
  TokenContractInfo,
  BridgedTokenSymbol,
  TokenSymbol,
} from '../token';
import WalletInfo from '../wallet-info';
import CustomStorageWalletConnect from '../wc-connector';
import {
  ChainAddress,
  Layer2Web3Strategy,
  TransactionHash,
  Layer2NetworkSymbol,
  Layer2ChainEvent,
  WithdrawalLimits,
  TxnBlockNumber,
} from './types';
import {
  networkIds,
  getConstantByNetwork,
  getSDK,
  BridgeValidationResult,
  DepotSafe,
  IHubAuth,
  ILayerTwoOracle,
  ISafes,
  MerchantSafe,
  PrepaidCardSafe,
  Safe,
  TransactionOptions,
  waitUntilBlock,
} from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import config from '../../config/environment';
import { TaskGenerator } from 'ember-concurrency';
import { action } from '@ember/object';
import { TypedChannel } from '../typed-channel';
import { UsdConvertibleSymbol } from '@cardstack/web-client/services/token-to-usd';
import { useResource } from 'ember-resources';
import { Safes } from '@cardstack/web-client/resources/safes';
import { IAssets } from '@cardstack/cardpay-sdk';
import { PrepaidCard } from '@cardstack/cardpay-sdk';
import { ViewSafesResult } from '@cardstack/cardpay-sdk';
import { faceValueOptions } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';
import { getLayer2RpcWssNodeUrl } from '../features';
import * as Sentry from '@sentry/browser';

const BROADCAST_CHANNEL_MESSAGES = {
  CONNECTED: 'CONNECTED',
} as const;

interface Layer2ConnectEvent {
  type: typeof BROADCAST_CHANNEL_MESSAGES.CONNECTED;
  session?: any;
}

const BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export default abstract class Layer2ChainWeb3Strategy
  implements Layer2Web3Strategy, Emitter<Layer2ChainEvent>
{
  chainId: number;
  networkSymbol: Layer2NetworkSymbol;
  provider: WalletConnectProvider | undefined;
  simpleEmitter = new SimpleEmitter();

  defaultTokenSymbol: BridgedTokenSymbol;
  bridgedDaiTokenSymbol: BridgedTokenSymbol;
  bridgedCardTokenSymbol: BridgedTokenSymbol;

  defaultTokenContractAddress?: string;
  web3!: Web3;
  #layerTwoOracleApi!: ILayerTwoOracle;
  #assetsApi!: IAssets;
  #safesApi!: ISafes;
  #hubAuthApi!: IHubAuth;
  #prepaidCardApi!: PrepaidCard;
  #broadcastChannel: TypedChannel<Layer2ConnectEvent>;
  @tracked walletInfo: WalletInfo;
  @tracked walletConnectUri: string | undefined;
  @tracked waitForAccountDeferred = defer();
  @tracked isInitializing = true;
  @tracked issuePrepaidCardSpendMinValue: number = 0;
  @tracked issuePrepaidCardDaiMinValue = new BN('0');

  @reads('provider.connector') connector!: IConnector;
  @reads('safes.depot') declare depotSafe: DepotSafe | null;

  constructor(networkSymbol: Layer2NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.networkSymbol = networkSymbol;
    this.walletInfo = new WalletInfo([]);
    this.bridgedDaiTokenSymbol = this.defaultTokenSymbol = getConstantByNetwork(
      'bridgedDaiTokenSymbol',
      networkSymbol
    ) as BridgedTokenSymbol;
    this.bridgedCardTokenSymbol = getConstantByNetwork(
      'bridgedCardTokenSymbol',
      networkSymbol
    ) as BridgedTokenSymbol;
    let defaultTokenContractInfo = this.getTokenContractInfo(
      this.defaultTokenSymbol,
      networkSymbol
    );
    this.defaultTokenContractAddress = defaultTokenContractInfo.address;
    this.#broadcastChannel = new TypedChannel(
      `cardstack-layer-2-connection-sync`
    );
    this.#broadcastChannel.addEventListener(
      'message',
      this.onBroadcastChannelMessage
    );
  }

  async fetchIssuePrepaidCardMinValues() {
    this.issuePrepaidCardSpendMinValue = Math.min(...faceValueOptions);
    this.issuePrepaidCardDaiMinValue = new BN(
      await this.convertFromSpend(
        this.bridgedDaiTokenSymbol,
        this.issuePrepaidCardSpendMinValue
      )
    );
  }

  @action onBroadcastChannelMessage(event: MessageEvent<Layer2ConnectEvent>) {
    // only try to connect if we weren't already connected
    // if we were already connected and there was an account change
    // we should be receiving the same "accountsChanged" event in each tab
    // from WalletConnect
    if (
      event.data.type === BROADCAST_CHANNEL_MESSAGES.CONNECTED &&
      !this.isConnected
    ) {
      taskFor(this.initializeTask).perform(event.data.session);
    }
  }

  @task *initializeTask(session?: any): TaskGenerator<void> {
    let connectorOptions;
    if (session) {
      connectorOptions = { session };
    } else {
      connectorOptions = {
        bridge: BRIDGE,
      };
    }
    this.web3 = new Web3();

    let rpcWss = getLayer2RpcWssNodeUrl(this.networkSymbol);
    this.provider = new WalletConnectProvider({
      chainId: this.chainId,
      rpc: {
        [networkIds[this.networkSymbol]]: getConstantByNetwork(
          'rpcNode',
          this.networkSymbol
        ),
      },
      rpcWss: {
        [networkIds[this.networkSymbol]]: rpcWss,
      },
      connector: new CustomStorageWalletConnect(connectorOptions, this.chainId),
    });

    this.provider.on('websocket-connected', () => {
      console.log('websocket connected');
      Sentry.addBreadcrumb({
        type: 'debug',
        message: 'Websocket connected',
        data: {
          url: rpcWss,
        },
        level: Sentry.Severity.Info,
      });
    });

    this.provider.on('websocket-disconnected', (event: CloseEvent) => {
      this.simpleEmitter.emit('websocket-disconnected');
      this.disconnect();
      console.log('websocket disconnected');
      Sentry.addBreadcrumb({
        type: 'debug',
        message: 'Websocket connection closed',
        data: {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: rpcWss,
        },
        // unsure about 1001 since this could also happen due to server failure
        // but also can happen due to closing the tab normally
        // unlike other codes which will only get here after the websocket provider
        // fails to reconnect, 1000 and 1001 will get here immediately if the closing was clean
        level: [1000, 1001].includes(event.code)
          ? Sentry.Severity.Info
          : Sentry.Severity.Error,
      });
    });

    this.web3.setProvider(this.provider as any);

    this.connector.on('display_uri', (err, payload) => {
      if (err) {
        console.error('Error in display_uri callback', err);
        return;
      }
      // if we get here when a user loads a page, then it means that the user did not have
      // a connection from local storage. We can safely say they are initialized
      this.isInitializing = false;
      this.simpleEmitter.emit('initialized');
      this.walletConnectUri = payload.params[0];
    });

    this.provider.on('accountsChanged', async (accounts: string[]) => {
      try {
        // try to initialize things safely
        // one expected failure is if we connect to a chain which we don't have an rpc url for
        this.#layerTwoOracleApi = await getSDK('LayerTwoOracle', this.web3);
        this.#safesApi = await getSDK('Safes', this.web3);
        this.#assetsApi = await getSDK('Assets', this.web3);
        this.#prepaidCardApi = await getSDK('PrepaidCard', this.web3);
        this.#hubAuthApi = await getSDK('HubAuth', this.web3, config.hubURL);
        await this.fetchIssuePrepaidCardMinValues();
        await this.updateWalletInfo(accounts);
        this.#broadcastChannel.postMessage({
          type: BROADCAST_CHANNEL_MESSAGES.CONNECTED,
          session: this.connector?.session,
        });
      } catch (e) {
        console.error(
          'Error initializing layer 2 wallet and services. Wallet may be connected to an unsupported chain'
        );
        console.error(e);
        this.disconnect();
      } finally {
        this.isInitializing = false;
        this.simpleEmitter.emit('initialized');
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

    yield this.provider.enable();
  }

  private getTokenContractInfo(
    symbol: TokenSymbol,
    network: Layer2NetworkSymbol
  ): TokenContractInfo {
    return new TokenContractInfo(symbol, network);
  }

  async updateWalletInfo(accounts: string[]) {
    let newWalletInfo = new WalletInfo(accounts);
    if (this.walletInfo.isEqualTo(newWalletInfo)) {
      return;
    }

    if (this.walletInfo.firstAddress && newWalletInfo.firstAddress) {
      this.simpleEmitter.emit('account-changed');
    }

    this.walletInfo = newWalletInfo;
    if (accounts.length) {
      await this.refreshSafesAndBalances();
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([]);
  }

  async refreshSafesAndBalances() {
    if (!this.isConnected) return;
    await this.safes.fetch();
    await this.safes.updateDepot();
  }

  private async updateSafeWithLatestValues(safe: Safe) {
    if (safe.type === 'prepaid-card') {
      return await this.updatePrepaidCardWithLatestValues(safe);
    } else if (safe.type === 'depot') {
      return await this.updateDepotWithLatestValues(safe);
    } else if (safe.type === 'merchant') {
      return await this.updateMerchantWithLatestValues(safe);
    } else {
      return safe;
    }
  }

  private async updatePrepaidCardWithLatestValues(
    safe: PrepaidCardSafe
  ): Promise<PrepaidCardSafe> {
    let latestFaceValue = await this.#prepaidCardApi.faceValue(safe.address);
    safe.spendFaceValue = latestFaceValue;
    return safe;
  }

  private async updateSafeDaiAndCardBalances<T extends Safe>(
    safe: T
  ): Promise<T> {
    let defaultTokenAddress = this.defaultTokenContractAddress;
    let cardTokenAddress = this.getTokenContractInfo(
      this.bridgedCardTokenSymbol,
      this.networkSymbol
    )!.address;

    let [defaultBalance, cardBalance] = await Promise.all([
      this.#assetsApi.getBalanceForToken(defaultTokenAddress!, safe.address),
      this.#assetsApi.getBalanceForToken(cardTokenAddress, safe.address),
    ]);

    safe.tokens.forEach((token) => {
      if (token.token.symbol === this.bridgedDaiTokenSymbol) {
        token.balance = defaultBalance;
      } else if (token.token.symbol === this.bridgedCardTokenSymbol) {
        token.balance = cardBalance;
      }
    });

    return safe;
  }

  private async updateMerchantWithLatestValues(
    safe: MerchantSafe
  ): Promise<MerchantSafe> {
    return this.updateSafeDaiAndCardBalances(safe);
  }

  private async updateDepotWithLatestValues(safe: DepotSafe) {
    return this.updateSafeDaiAndCardBalances(safe);
  }

  async getLatestSafe(address: string): Promise<Safe> {
    let safe = (await this.#safesApi.viewSafe(address))?.safe;
    if (!safe) throw new Error(`Could not find safe at: ${address}`);
    return await this.updateSafeWithLatestValues(safe);
  }

  @task *viewSafesTask(
    account: string = this.walletInfo.firstAddress!
  ): TaskGenerator<ViewSafesResult> {
    if (!account) {
      return { blockNumber: 0, safes: [] };
    }

    return yield this.#safesApi.view(account);
  }

  async issuePrepaidCard(
    safeAddress: string,
    amount: number,
    customizationDid: string,
    options: TransactionOptions
  ): Promise<PrepaidCardSafe> {
    const PrepaidCard = await getSDK('PrepaidCard', this.web3);

    const result = await PrepaidCard.create(
      safeAddress,
      this.defaultTokenContractAddress!,
      [amount],
      undefined,
      customizationDid,
      options
    );

    return result.prepaidCards[0];
  }

  async resumeIssuePrepaidCardTransaction(
    txnHash: string
  ): Promise<PrepaidCardSafe> {
    const PrepaidCard = await getSDK('PrepaidCard', this.web3);
    let result = await PrepaidCard.create(txnHash);

    return result.prepaidCards[0];
  }

  async fetchMerchantRegistrationFee(): Promise<number> {
    const RevenuePool = await getSDK('RevenuePool', this.web3);
    return await RevenuePool.merchantRegistrationFee(); // this is a SPEND amount
  }

  async registerMerchant(
    prepaidCardAddress: string,
    infoDid: string,
    options: TransactionOptions
  ) {
    const RevenuePool = await getSDK('RevenuePool', this.web3);

    let { merchantSafe } = await RevenuePool.registerMerchant(
      prepaidCardAddress,
      infoDid,
      options
    );

    return merchantSafe;
  }

  async resumeRegisterMerchantTransaction(
    txnHash: string
  ): Promise<MerchantSafe> {
    const RevenuePool = await getSDK('RevenuePool', this.web3);
    let { merchantSafe } = await RevenuePool.registerMerchant(txnHash);

    return merchantSafe;
  }

  // unlike layer 1 with metamask, there is no necessity for cross-tab communication
  // about disconnecting. WalletConnect's disconnect event tells all tabs that you are disconnected
  onDisconnect() {
    this.clearWalletInfo();
    this.safes.clear();
    this.walletConnectUri = undefined;

    this.simpleEmitter.emit('disconnect');

    // we always want to re-generate the uri, because the 'disconnect' event from WalletConnect
    // covers clicking the 'cancel' button in the wallet/mobile app
    // if we don't re-generate the uri, then users might be stuck with the old one that cannot
    // scan/fails silently
    setTimeout(() => {
      console.log('initializing');
      taskFor(this.initializeTask).perform();
    }, 500);
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }
  get defaultTokenBalance() {
    return new BN(
      this.safes.depot?.tokens.find(
        (v) => v.token.symbol === this.defaultTokenSymbol
      )?.balance ?? 0
    );
  }

  get cardBalance() {
    return new BN(
      this.safes.depot?.tokens.find(
        (v) => v.token.symbol === this.bridgedCardTokenSymbol
      )?.balance ?? 0
    );
  }

  async updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Record<UsdConvertibleSymbol, ConversionFunction>> {
    let promisesHash = {} as Record<
      UsdConvertibleSymbol,
      Promise<ConversionFunction>
    >;
    for (let symbol of symbolsToUpdate) {
      promisesHash[symbol] = this.#layerTwoOracleApi.getUSDConverter(
        symbol.replace(/\.CPXD$/i, '')
      );
    }
    return hash(promisesHash);
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'blockExplorer',
      this.networkSymbol
    )}/tx/${txnHash}`;
  }

  async getBlockConfirmation(blockNumber: TxnBlockNumber): Promise<void> {
    if (!this.web3)
      throw new Error('Cannot get block confirmations without web3');
    return await waitUntilBlock(this.web3, blockNumber);
  }

  async getBlockHeight(): Promise<BN> {
    const result = await this.web3.eth.getBlockNumber();
    return new BN(result.toString());
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async getWithdrawalLimits(
    tokenSymbol: BridgedTokenSymbol
  ): Promise<WithdrawalLimits> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    let contractInfo = this.getTokenContractInfo(
      tokenSymbol,
      this.networkSymbol
    );

    let { min, max } = await tokenBridge.getWithdrawalLimits(
      contractInfo.address
    );

    return {
      min: new BN(min),
      max: new BN(max),
    };
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
    receiverAddress: string,
    tokenSymbol: BridgedTokenSymbol,
    amountInWei: string,
    options: TransactionOptions
  ): Promise<TransactionReceipt> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    let tokenAddress = new TokenContractInfo(tokenSymbol, this.networkSymbol)!
      .address;

    return await tokenBridge.relayTokens(
      safeAddress,
      tokenAddress,
      receiverAddress,
      amountInWei,
      options
    );
  }

  async resumeBridgeToLayer1(txnHash: string) {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);

    return await tokenBridge.relayTokens(txnHash);
  }

  async awaitBridgedToLayer1(
    fromBlock: BN,
    txnHash: TransactionHash
  ): Promise<BridgeValidationResult> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    return tokenBridge.waitForBridgingValidation(fromBlock.toString(), txnHash);
  }

  async convertFromSpend(
    symbol: ConvertibleSymbol,
    amount: number
  ): Promise<string> {
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

    return await this.#layerTwoOracleApi.convertFromSpend(address, amount);
  }

  async authenticate(): Promise<string> {
    return this.#hubAuthApi.authenticate();
  }

  checkHubAuthenticationValid(authToken: string): Promise<boolean> {
    return this.#hubAuthApi.checkValidAuth(authToken);
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

  safes = useResource(this, Safes, () => ({
    strategy: this,
    walletAddress: this.walletInfo.firstAddress!,
  }));
}
