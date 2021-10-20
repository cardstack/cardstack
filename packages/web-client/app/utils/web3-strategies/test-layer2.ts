import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer2Web3Strategy, TransactionHash, WithdrawalLimits } from './types';
import {
  BridgeableSymbol,
  BridgedTokenSymbol,
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import RSVP, { defer } from 'rsvp';
import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import {
  BridgeValidationResult,
  DepotSafe,
  MerchantSafe,
  PrepaidCardSafe,
  Safe,
  TokenInfo,
  TransactionOptions,
} from '@cardstack/cardpay-sdk';
import {
  UnbindEventListener,
  SimpleEmitter,
} from '@cardstack/web-client/utils/events';
import { task, TaskGenerator } from 'ember-concurrency';
import { UsdConvertibleSymbol } from '@cardstack/web-client/services/token-to-usd';
import { useResource } from 'ember-resources';
import { Safes } from '@cardstack/web-client/resources/safes';
import { reads } from 'macro-decorators';
import { createPrepaidCardSafe } from '@cardstack/web-client/utils/test-factories';
import { ViewSafesResult } from '@cardstack/cardpay-sdk/sdk/safes/base';

interface BridgeToLayer1Request {
  safeAddress: string;
  receiverAddress: string;
  tokenSymbol: BridgeableSymbol;
  amountInWei: string;
}

interface IssuePrepaidCardRequest {
  deferred: RSVP.Deferred<PrepaidCardSafe>;
  onTxnHash?: (txnHash: TransactionHash) => void;
  onNonce?: (nonce: BN) => void;
  nonce?: BN;
  customizationDID: string;
}

interface RegisterMerchantRequest {
  deferred: RSVP.Deferred<MerchantSafe>;
  onTxnHash?: (txnHash: TransactionHash) => void;
  onNonce?: (nonce: BN) => void;
  nonce?: BN;
  infoDID: string;
}
export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainId = '-1';
  simpleEmitter = new SimpleEmitter();
  defaultTokenSymbol: ConvertibleSymbol = 'DAI';
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([]);
  waitForAccountDeferred = defer();
  bridgingToLayer2Deferred!: RSVP.Deferred<TransactionReceipt>;
  bridgingToLayer1HashDeferred!: RSVP.Deferred<TransactionHash>;
  bridgingToLayer1Deferred!: RSVP.Deferred<BridgeValidationResult>;
  @tracked isInitializing = false;

  bridgeToLayer1Requests: BridgeToLayer1Request[] = [];
  issuePrepaidCardRequests: Map<number, IssuePrepaidCardRequest> = new Map();
  registerMerchantRequests: Map<string, RegisterMerchantRequest> = new Map();
  @tracked remoteAccountSafes: Map<string, Safe[]> = new Map();

  // property to test whether the refreshSafesAndBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  test__blockNumber = 0;
  test__withdrawalMinimum = new BN('500000000000000000');
  test__withdrawalMaximum = new BN('1500000000000000000000000');

  @reads('safes.depot') declare depotSafe: DepotSafe | null;

  @task *initializeTask(): TaskGenerator<void> {
    yield '';
    return;
  }

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([]);
    this.simpleEmitter.emit('disconnect');
    return this.waitForAccount as Promise<void>;
  }

  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  test__simulateDisconnectFromWallet() {
    this.disconnect();
  }

  getBlockHeight(): Promise<BN> {
    return Promise.resolve(new BN(this.test__blockNumber++));
  }

  async refreshSafesAndBalances() {
    this.balancesRefreshed = true;
    await this.safes.fetch();
  }

  async getWithdrawalLimits(
    _tokenSymbol: BridgedTokenSymbol
  ): Promise<WithdrawalLimits> {
    return {
      min: this.test__withdrawalMinimum,
      max: this.test__withdrawalMaximum,
    };
  }

  awaitBridgedToLayer2(
    _fromBlock: BN,
    _receiver: string
  ): Promise<TransactionReceipt> {
    this.bridgingToLayer2Deferred = defer<TransactionReceipt>();
    return this.bridgingToLayer2Deferred.promise as Promise<TransactionReceipt>;
  }

  bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgeableSymbol,
    amountInWei: string
  ): Promise<TransactionHash> {
    this.bridgeToLayer1Requests.push({
      safeAddress,
      receiverAddress,
      tokenSymbol,
      amountInWei,
    });
    this.bridgingToLayer1HashDeferred = defer<TransactionHash>();
    this.bridgingToLayer1Deferred = defer<BridgeValidationResult>();
    return this.bridgingToLayer1HashDeferred.promise;
  }

  awaitBridgedToLayer1(
    _fromBlock: BN,
    _txnHash: string
  ): Promise<BridgeValidationResult> {
    return this.bridgingToLayer1Deferred
      .promise as Promise<BridgeValidationResult>;
  }

  async updateUsdConverters(symbolsToUpdate: UsdConvertibleSymbol[]) {
    this.test__lastSymbolsToUpdate = symbolsToUpdate;
    let result = {} as Record<UsdConvertibleSymbol, ConversionFunction>;
    for (let symbol of symbolsToUpdate) {
      result[symbol] = (amountInWei: string) => {
        return Number(fromWei(amountInWei)) * this.test__simulatedExchangeRate;
      };
    }
    if (this.test__updateUsdConvertersDeferred) {
      await this.test__updateUsdConvertersDeferred.promise;
    }
    return Promise.resolve(result);
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  get isConnected() {
    return this.walletInfo.accounts.length > 0;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
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

  async convertFromSpend(symbol: ConvertibleSymbol, amount: number) {
    return await this.test__simulateConvertFromSpend(symbol, amount);
  }

  async getLatestSafe(address: string): Promise<Safe> {
    let result = this.remoteAccountSafes
      .get(this.walletInfo.firstAddress!)!
      .find((safe) => safe.address === address)!;
    if (!result) return result;
    else return JSON.parse(JSON.stringify(result));
  }

  test__autoResolveViewSafes = true;

  @task *viewSafesTask(
    account: string = this.walletInfo.firstAddress!
  ): TaskGenerator<ViewSafesResult> {
    if (this.test__autoResolveViewSafes) {
      return {
        safes: JSON.parse(
          JSON.stringify(this.remoteAccountSafes.get(account) ?? [])
        ),
        blockNumber: this.test__blockNumber++,
      };
    }
    this.test__deferredViewSafes = defer();
    return yield this.test__deferredViewSafes.promise;
  }

  test__simulateRemoteAccountSafes(account: string, newSafes: Safe[]) {
    if (!this.remoteAccountSafes.has(account)) {
      this.remoteAccountSafes.set(account, []);
    }
    let newRemoteAccountSafes = newSafes
      .concat(this.remoteAccountSafes.get(account)!)
      .filter(
        (v, i, a) => a.findIndex((safe) => safe.address === v.address) === i
      );
    this.remoteAccountSafes.set(account, newRemoteAccountSafes);
  }

  async issuePrepaidCard(
    _safeAddress: string,
    faceValue: number,
    customizationDID: string,
    options: TransactionOptions
  ): Promise<PrepaidCardSafe> {
    let deferred: RSVP.Deferred<PrepaidCardSafe> = defer();
    this.issuePrepaidCardRequests.set(faceValue, {
      deferred,
      onTxnHash: options.onTxnHash,
      onNonce: options.onNonce,
      nonce: options.nonce,
      customizationDID,
    });
    return deferred.promise;
  }

  fetchMerchantRegistrationFee() {
    return Promise.resolve(100);
  }

  resumeIssuePrepaidCardTransaction(
    _txnHash: string
  ): Promise<PrepaidCardSafe> {
    return defer<PrepaidCardSafe>().promise;
  }

  async registerMerchant(
    prepaidCardAddress: string,
    infoDID: string,
    options: TransactionOptions
  ): Promise<MerchantSafe> {
    let deferred: RSVP.Deferred<MerchantSafe> = defer();
    this.registerMerchantRequests.set(prepaidCardAddress, {
      deferred,
      onTxnHash: options.onTxnHash,
      onNonce: options.onNonce,
      nonce: options.nonce,
      infoDID,
    });
    return deferred.promise;
  }

  resumeRegisterMerchantTransaction(_txnHash: string): Promise<MerchantSafe> {
    return defer<MerchantSafe>().promise;
  }

  authenticate(): Promise<string> {
    this.test__deferredHubAuthentication = defer();
    return this.test__deferredHubAuthentication.promise;
  }

  checkHubAuthenticationValid(_authToken: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  safes = useResource(this, Safes, () => ({
    strategy: this,
    walletAddress: this.walletInfo.firstAddress!,
  }));

  test__lastSymbolsToUpdate: UsdConvertibleSymbol[] = [];
  test__simulatedExchangeRate: number = 0.2;
  test__updateUsdConvertersDeferred: RSVP.Deferred<void> | undefined;
  test__deferredHubAuthentication!: RSVP.Deferred<string>;
  test__deferredViewSafes!: RSVP.Deferred<ViewSafesResult>;

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  async test__simulateAccountsChanged(accounts: string[]) {
    let newWalletInfo = new WalletInfo(accounts);

    if (
      this.walletInfo.firstAddress &&
      newWalletInfo.firstAddress &&
      !this.walletInfo.isEqualTo(newWalletInfo)
    ) {
      this.simpleEmitter.emit('account-changed');
    }

    this.walletInfo = newWalletInfo;
    await this.refreshSafesAndBalances();
    await this.waitForAccountDeferred.resolve();
  }

  test__simulateBridgedToLayer2(txnHash: TransactionHash) {
    this.bridgingToLayer2Deferred.resolve({
      transactionHash: txnHash,
    } as TransactionReceipt);
  }

  test__simulateConvertFromSpend(symbol: ConvertibleSymbol, amount: number) {
    let spendToDaiSimRate = 0.01;
    if (symbol === 'DAI') {
      return toWei(`${amount * spendToDaiSimRate}`);
    } else {
      return '0';
    }
  }

  test__getNonceForIssuePrepaidCardRequest(faceValue: number): BN | undefined {
    let request = this.issuePrepaidCardRequests.get(faceValue);
    return request?.nonce;
  }

  test__simulateOnNonceForIssuePrepaidCardRequest(
    faceValue: number,
    nonce: BN
  ): void {
    let request = this.issuePrepaidCardRequests.get(faceValue);
    request?.onNonce?.(nonce);
  }

  test__simulateIssuePrepaidCardForAmount(
    faceValue: number,
    walletAddress: string,
    cardAddress: string,
    options: Partial<PrepaidCardSafe>
  ) {
    let request = this.issuePrepaidCardRequests.get(faceValue);
    let prepaidCardSafe = createPrepaidCardSafe({
      address: cardAddress,
      owners: [walletAddress],
      spendFaceValue: faceValue,
      prepaidCardOwner: walletAddress,
      issuer: walletAddress,
      customizationDID: request?.customizationDID,
      ...options,
    });
    request?.onTxnHash?.('exampleTxnHash');

    this.test__simulateRemoteAccountSafes(walletAddress, [prepaidCardSafe]);
    let unfetchedDepot = this.remoteAccountSafes
      .get(this.walletInfo.firstAddress!)!
      .find((v: Safe) => v.address === this.depotSafe?.address);

    unfetchedDepot!.tokens.forEach((t: TokenInfo) => {
      if (t.token.symbol === 'DAI') {
        t.balance = new BN(t.balance)
          .sub(new BN(toWei((faceValue / 100).toString())))
          .toString();
      }
    });

    return request?.deferred.resolve(prepaidCardSafe);
  }

  test__getNonceForRegisterMerchantRequest(
    prepaidCardAddress: string
  ): BN | undefined {
    let request = this.registerMerchantRequests.get(prepaidCardAddress);
    return request?.nonce;
  }

  test__simulateOnNonceForRegisterMerchantRequest(
    prepaidCardAddress: string,
    nonce: BN
  ): void {
    let request = this.registerMerchantRequests.get(prepaidCardAddress);
    request?.onNonce?.(nonce);
  }

  async test__simulateRegisterMerchantForAddress(
    prepaidCardAddress: string,
    merchantSafeAddress: string,
    options: Object
  ) {
    let request = this.registerMerchantRequests.get(prepaidCardAddress);
    let merchantSafe: MerchantSafe = {
      type: 'merchant',
      createdAt: Date.now() / 1000,
      address: merchantSafeAddress,
      merchant: prepaidCardAddress,
      tokens: [],
      owners: [],
      accumulatedSpendValue: 100,
      infoDID: request?.infoDID,

      ...options,
    };
    request?.onTxnHash?.('exampleTxnHash');

    let prepaidCard = this.remoteAccountSafes
      .get(this.walletInfo.firstAddress!)!
      .find((safe) => safe.address === prepaidCardAddress);

    let merchantCreationFee = await this.fetchMerchantRegistrationFee();

    if (prepaidCard && prepaidCard.type === 'prepaid-card') {
      prepaidCard.spendFaceValue =
        prepaidCard.spendFaceValue - merchantCreationFee;
    }

    this.test__simulateRemoteAccountSafes(this.walletInfo.firstAddress!, [
      merchantSafe,
    ]);
    return request?.deferred.resolve(merchantSafe);
  }

  async test__simulateRegisterMerchantRejectionForAddress(
    prepaidCardAddress: string
  ) {
    let request = this.registerMerchantRequests.get(prepaidCardAddress);
    return request?.deferred.reject(
      new Error('User rejected merchant creation')
    );
  }

  test__simulateHubAuthentication(authToken: string) {
    return this.test__deferredHubAuthentication.resolve(authToken);
  }

  async test__simulateBridgedToLayer1(
    safeAddress?: string,
    receiverAddress?: string,
    tokenSymbol?: BridgeableSymbol,
    amountInWei?: string
  ): Promise<void> {
    if (safeAddress && receiverAddress && tokenSymbol && amountInWei) {
      let matchingRequest = this.bridgeToLayer1Requests.find(
        (request) =>
          request.safeAddress === safeAddress &&
          request.receiverAddress === receiverAddress &&
          request.tokenSymbol === tokenSymbol &&
          request.amountInWei === amountInWei
      );

      if (matchingRequest) {
        // Update the safe token balance if it exists
        let safe = this.remoteAccountSafes
          .get(this.walletInfo.firstAddress!)!
          .findBy('address', safeAddress);

        if (safe) {
          safe.tokens.forEach((t: TokenInfo) => {
            if (t.token.symbol === tokenSymbol) {
              t.balance = new BN(t.balance).sub(new BN(amountInWei)).toString();
            }
          });
        }
      } else {
        throw new Error(
          `No matching bridging request found for ${JSON.stringify(
            arguments
          )}; requests: ${JSON.stringify(this.bridgeToLayer1Requests)}`
        );
      }
    }

    this.bridgingToLayer1Deferred.resolve({
      messageId: 'example-message-id',
      encodedData: 'example-encoded-data',
      signatures: ['example-sig'],
    });

    return this.test__simulateAccountsChanged([this.walletInfo.firstAddress!]);
  }
}
