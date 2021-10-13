import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { IConnector } from '@walletconnect/types';
import WalletConnectProvider from '../wc-provider';
import { task } from 'ember-concurrency-decorators';

import { Emitter, SimpleEmitter, UnbindEventListener } from '../events';
import {
  BridgeableSymbol,
  ConvertibleSymbol,
  ConversionFunction,
  TokenContractInfo,
  BridgedTokenSymbol,
  getUnbridgedSymbol,
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
} from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import config from '../../config/environment';
import { TaskGenerator } from 'ember-concurrency';
import { action } from '@ember/object';
import { TypedChannel } from '../typed-channel';
import { UsdConvertibleSymbol } from '@cardstack/web-client/services/token-to-usd';
import { useResource } from 'ember-resources';
import { Safes } from '@cardstack/web-client/resources/safes';
import { IAssets } from '../../../../cardpay-sdk/sdk/assets';
import PrepaidCard from '@cardstack/cardpay-sdk/sdk/prepaid-card/base';

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
  defaultTokenSymbol: ConvertibleSymbol = 'DAI';
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

  @reads('provider.connector') connector!: IConnector;
  @reads('safes.depot') declare depotSafe: DepotSafe | null;

  constructor(networkSymbol: Layer2NetworkSymbol) {
    this.chainId = networkIds[networkSymbol];
    this.networkSymbol = networkSymbol;
    this.walletInfo = new WalletInfo([]);
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
    this.provider = new WalletConnectProvider({
      chainId: this.chainId,
      rpc: {
        [networkIds[this.networkSymbol]]: getConstantByNetwork(
          'rpcNode',
          this.networkSymbol
        ),
      },
      rpcWss: {
        [networkIds[this.networkSymbol]]: getConstantByNetwork(
          'rpcWssNode',
          this.networkSymbol
        ),
      },
      connector: new CustomStorageWalletConnect(connectorOptions, this.chainId),
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
    symbol: ConvertibleSymbol,
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
    await this.safes.fetch();
    await this.safes.updateDepot();
  }

  async fetchSafesForAccount(account: string = this.walletInfo.firstAddress!) {
    return await this.#safesApi.view(account);
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
      'CARD',
      this.networkSymbol
    )!.address;

    let [defaultBalance, cardBalance] = await Promise.all([
      this.#assetsApi.getBalanceForToken(defaultTokenAddress!, safe.address),
      this.#assetsApi.getBalanceForToken(cardTokenAddress, safe.address),
    ]);

    safe.tokens.forEach((token) => {
      if (token.token.symbol === 'DAI') {
        token.balance = defaultBalance;
      } else if (token.token.symbol === 'CARD') {
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
    let safe = (await this.#safesApi.viewSafe(address))?.result;
    if (!safe) throw new Error(`Could not find safe at: ${address}`);
    return await this.updateSafeWithLatestValues(safe);
  }

  @task *viewSafesTask(
    account: string = this.walletInfo.firstAddress!
  ): TaskGenerator<{ result: Safe[]; blockNumber: number }> {
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
      this.safes.depot?.tokens.find((v) => v.token.symbol === 'DAI')?.balance ??
        0
    );
  }

  get cardBalance() {
    return new BN(
      this.safes.depot?.tokens.find((v) => v.token.symbol === 'CARD')
        ?.balance ?? 0
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
      getUnbridgedSymbol(tokenSymbol),
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
    tokenSymbol: BridgeableSymbol,
    amountInWei: string
  ): Promise<TransactionHash> {
    let tokenBridge = await getSDK('TokenBridgeHomeSide', this.web3);
    let tokenAddress = new TokenContractInfo(tokenSymbol, this.networkSymbol)!
      .address;

    // in this case we don't want to wait for mining to complete. there is a
    // purpose built await in the SDK for the bridge validators that is
    // performed after this action--we can just rely on that for the timing

    let transactionHash = await new Promise<TransactionHash>((res, reject) => {
      tokenBridge
        .relayTokens(safeAddress, tokenAddress, receiverAddress, amountInWei, {
          onTxnHash: (txnHash) => res(txnHash),
        })
        .catch((e) => {
          reject(e);
        });
    });
    return transactionHash;
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
