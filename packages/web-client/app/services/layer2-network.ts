import Service from '@ember/service';
import config from '../config/environment';
import { inject as service } from '@ember/service';
import { TaskGenerator } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { useResource } from 'ember-resources';
import {
  IssuePrepaidCardOptions,
  Layer2ChainEvent,
  Layer2Web3Strategy,
  RegisterMerchantOptions,
  TransactionHash,
} from '../utils/web3-strategies/types';
import Layer2TestWeb3Strategy from '../utils/web3-strategies/test-layer2';
import XDaiWeb3Strategy from '../utils/web3-strategies/x-dai';
import SokolWeb3Strategy from '../utils/web3-strategies/sokol';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';
import BN from 'bn.js';
import { DepotSafe, Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { Safes } from '@cardstack/web-client/resources/safes';
import {
  BridgeableSymbol,
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import {
  Emitter,
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';
import { action } from '@ember/object';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { taskFor } from 'ember-concurrency-ts';
import { UsdConvertibleSymbol } from './token-to-usd';
export default class Layer2Network
  extends Service
  implements Emitter<Layer2ChainEvent>
{
  @service declare hubAuthentication: HubAuthentication;
  strategy!: Layer2Web3Strategy;
  simpleEmitter = new SimpleEmitter();
  @reads('strategy.isInitializing') declare isInitializing: boolean;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', []) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;
  @reads('strategy.usdConverters') usdConverters!: {
    [symbol: string]: (amountInWei: string) => number;
  };
  @reads('stragey.viewSafesTask') declare viewSafesTask: TaskGenerator<Safe[]>;
  @reads('safes.depot.defaultTokenBalance') defaultTokenBalance: BN | undefined;
  @reads('safes.depot.cardBalance') cardBalance: BN | undefined;
  @reads('safes.depot.value') depotSafe: DepotSafe | undefined;
  @reads('safes.isLoading') declare isFetchingDepot: boolean;

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer2) {
      case 'xdai':
        this.strategy = new XDaiWeb3Strategy();
        break;
      case 'sokol':
        this.strategy = new SokolWeb3Strategy();
        break;
      case 'test':
        this.strategy = new Layer2TestWeb3Strategy();
        break;
    }

    this.strategy.on('disconnect', this.onDisconnect);
    this.strategy.on('incorrect-chain', this.onIncorrectChain);
    this.strategy.on('account-changed', this.onAccountChanged);

    taskFor(this.strategy.initializeTask).perform();
  }

  async updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Partial<Record<UsdConvertibleSymbol, ConversionFunction>>> {
    if (symbolsToUpdate.length === 0) {
      return {};
    }
    if (!this.walletInfo.firstAddress) {
      throw new Error(
        'Cannot fetch USD conversion without being connected to Layer 2'
      );
    }
    return this.strategy.updateUsdConverters(symbolsToUpdate);
  }

  async convertFromSpend(symbol: ConvertibleSymbol, amount: number) {
    return await this.strategy.convertFromSpend(symbol, amount);
  }

  authenticate(): Promise<string> {
    return this.strategy.authenticate();
  }

  checkHubAuthenticationValid(authToken: string): Promise<boolean> {
    return this.strategy.checkHubAuthenticationValid(authToken);
  }

  bridgeExplorerUrl(txnHash: string) {
    return txnHash ? this.strategy.bridgeExplorerUrl(txnHash) : undefined;
  }

  @task *viewSafeTask(address: string): TaskGenerator<Safe> {
    return yield this.strategy.viewSafe(address);
  }

  safes = useResource(this, Safes, () => ({
    strategy: this.strategy,
    walletAddress: this.walletInfo.firstAddress!,
  }));

  @task *issuePrepaidCardTask(
    faceValue: number,
    customizationDid: string,
    options: IssuePrepaidCardOptions
  ): any {
    let address = yield this.strategy.issuePrepaidCard(
      this.depotSafe?.address!,
      faceValue,
      customizationDid,
      options
    );

    // Refreshes safes so that external component shows up-to-date list of the user's prepaid cards
    this.refreshSafesAndBalances();

    return address;
  }

  @task *fetchMerchantRegistrationFeeTask(): TaskGenerator<number> {
    return yield this.strategy.fetchMerchantRegistrationFee();
  }

  @task *registerMerchantTask(
    prepaidCardAddress: string,
    infoDid: string,
    options: RegisterMerchantOptions
  ): any {
    let merchant = yield this.strategy.registerMerchant(
      prepaidCardAddress,
      infoDid,
      options
    );

    // Ensure prepaid card balance is updated
    yield this.refreshSafesAndBalances();

    return merchant;
  }

  disconnect() {
    return this.strategy.disconnect();
  }

  @action onDisconnect() {
    this.hubAuthentication.authToken = null;
    this.simpleEmitter.emit('disconnect');
  }

  @action onIncorrectChain() {
    this.simpleEmitter.emit('incorrect-chain');
  }

  @action onAccountChanged() {
    this.simpleEmitter.emit('account-changed');
  }

  on(event: Layer2ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  getBlockHeight() {
    return this.strategy.getBlockHeight();
  }

  async awaitBridgedToLayer2(fromBlock: BN) {
    return this.strategy.awaitBridgedToLayer2(
      fromBlock,
      this.walletInfo.firstAddress!
    );
  }

  blockExplorerUrl(txnHash: string | undefined): string | undefined {
    return txnHash ? this.strategy.blockExplorerUrl(txnHash) : undefined;
  }

  async refreshSafesAndBalances() {
    return this.strategy.refreshSafesAndBalances();
  }

  async bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgeableSymbol,
    amount: string
  ): Promise<TransactionHash> {
    return this.strategy.bridgeToLayer1(
      safeAddress,
      receiverAddress,
      tokenSymbol,
      amount
    );
  }

  async awaitBridgedToLayer1(fromBlock: BN, transactionHash: TransactionHash) {
    return this.strategy.awaitBridgedToLayer1(fromBlock, transactionHash);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'layer2-network': Layer2Network;
  }
}
