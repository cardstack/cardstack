import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import {
  Layer2Web3Strategy,
  TransactionHash,
  TxnBlockNumber,
  WithdrawalLimits,
} from './types';
import {
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
import { Safes } from '@cardstack/web-client/resources/safes';
import { reads } from 'macro-decorators';
import {
  createPrepaidCardSafe,
  createProfileSafe,
} from '@cardstack/web-client/utils/test-factories';
import { ViewSafesResult } from '@cardstack/cardpay-sdk';

interface BridgeToLayer1Request {
  safeAddress: string;
  receiverAddress: string;
  tokenSymbol: BridgedTokenSymbol;
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
  defaultTokenSymbol: BridgedTokenSymbol = 'DAI.CPXD';
  bridgedDaiTokenSymbol: BridgedTokenSymbol = 'DAI.CPXD';
  bridgedCardTokenSymbol: BridgedTokenSymbol = 'CARD.CPXD';
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([]);
  waitForAccountDeferred = defer();
  bridgingToLayer2Deferred!: RSVP.Deferred<TransactionReceipt>;
  bridgingToLayer1HashDeferred!: RSVP.Deferred<TransactionHash>;
  bridgingToLayer1Deferred!: RSVP.Deferred<BridgeValidationResult>;
  blockConfirmationDeferred!: RSVP.Deferred<void>;
  @tracked isInitializing = false;
  @tracked issuePrepaidCardSpendMinValue: number = 500;
  @tracked issuePrepaidCardDaiMinValue: BN = new BN(toWei('5'));

  bridgeToLayer1Requests: BridgeToLayer1Request[] = [];
  issuePrepaidCardRequests: Map<string, IssuePrepaidCardRequest> = new Map();
  registerMerchantRequests: Map<string, RegisterMerchantRequest> = new Map();
  @tracked remoteAccountSafes: Map<string, Safe[]> = new Map();

  // property to test whether the refreshSafesAndBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  test__autoResolveBlockConfirmations = true;

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
    if (!this.isConnected) return;
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

  async getBlockConfirmation(
    _blockNumber: TxnBlockNumber,
    _duration?: number
  ): Promise<void> {
    if (this.test__autoResolveBlockConfirmations) {
      return Promise.resolve();
    } else {
      this.blockConfirmationDeferred = defer<void>();
      return this.blockConfirmationDeferred.promise as Promise<void>;
    }
  }

  test__simulateBlockConfirmation() {
    this.blockConfirmationDeferred.resolve();
  }

  awaitBridgedToLayer2(
    _fromBlock: BN,
    _receiver: string
  ): Promise<TransactionReceipt> {
    this.bridgingToLayer2Deferred = defer<TransactionReceipt>();
    return this.bridgingToLayer2Deferred.promise as Promise<TransactionReceipt>;
  }

  async bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgedTokenSymbol,
    amountInWei: string,
    options: TransactionOptions
  ): Promise<TransactionReceipt> {
    this.bridgeToLayer1Requests.push({
      safeAddress,
      receiverAddress,
      tokenSymbol,
      amountInWei,
    });
    this.bridgingToLayer1Deferred = defer<BridgeValidationResult>();
    options.onTxnHash?.('exampleTxnHash');
    return {
      blockNumber: this.test__blockNumber,
    } as TransactionReceipt;
  }

  async resumeBridgeToLayer1(_txnHash: string) {
    return {
      blockNumber: this.test__blockNumber,
    } as TransactionReceipt;
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
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&q=BlockExplorer&txnHash=${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&q=BridgeExplorer&txnHash=${txnHash}`;
  }

  get isConnected() {
    return this.walletInfo.accounts.length > 0;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
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
      this.safes.depot?.tokens.find((v) => v.token.symbol === 'CARD.CPXD')
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

    /**
     * keep order of existing safes the same, put new safes at the front
     * this maintains a "stable" order of safes assuming that their createdAt dates
     * stay the same, which they should if using factories
     */
    let result = this.remoteAccountSafes.get(account)!;
    let actuallyNewSafes: Safe[] = [];
    for (let newSafe of newSafes) {
      let indexOfExistingSafe = result.findIndex(
        (existingSafe) => existingSafe.address === newSafe.address
      );
      if (indexOfExistingSafe !== -1) {
        result[indexOfExistingSafe] = newSafe;
      } else {
        actuallyNewSafes.push(newSafe);
      }
    }
    result = actuallyNewSafes.concat(result);

    this.remoteAccountSafes.set(account, result);
  }

  async issuePrepaidCard(
    safeAddress: string,
    faceValue: number,
    customizationDID: string,
    options: TransactionOptions
  ): Promise<PrepaidCardSafe> {
    let deferred: RSVP.Deferred<PrepaidCardSafe> = defer();
    this.issuePrepaidCardRequests.set(`${faceValue}:${safeAddress}`, {
      deferred,
      onTxnHash: options.onTxnHash,
      onNonce: options.onNonce,
      nonce: options.nonce,
      customizationDID,
    });
    return deferred.promise;
  }

  fetchProfileRegistrationFee() {
    return Promise.resolve(100);
  }

  resumeIssuePrepaidCardTransaction(
    _txnHash: string
  ): Promise<PrepaidCardSafe> {
    return defer<PrepaidCardSafe>().promise;
  }

  async registerProfile(
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

  resumeRegisterProfileTransaction(_txnHash: string): Promise<MerchantSafe> {
    return defer<MerchantSafe>().promise;
  }

  authenticate(): Promise<string> {
    this.test__deferredHubAuthentication = defer();
    return this.test__deferredHubAuthentication.promise;
  }

  checkHubAuthenticationValid(_authToken: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  safes = Safes.from(this, () => ({
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
    if (symbol === 'DAI.CPXD') {
      return toWei(`${amount * spendToDaiSimRate}`);
    } else {
      return '0';
    }
  }

  test__getNonceForIssuePrepaidCardRequest(
    faceValue: number,
    fundingSourceAddress: string
  ): BN | undefined {
    let request = this.issuePrepaidCardRequests.get(
      `${faceValue}:${fundingSourceAddress}`
    );
    return request?.nonce;
  }

  test__simulateOnNonceForIssuePrepaidCardRequest(
    faceValue: number,
    fundingSourceAddress: string,
    nonce: BN
  ): void {
    let request = this.issuePrepaidCardRequests.get(
      `${faceValue}:${fundingSourceAddress}`
    );
    request?.onNonce?.(nonce);
  }

  test__simulateIssuePrepaidCardForAmountFromSource(
    faceValue: number,
    fundingSourceAddress: string,
    walletAddress: string,
    cardAddress: string,
    options: Partial<PrepaidCardSafe>
  ) {
    let request = this.issuePrepaidCardRequests.get(
      `${faceValue}:${fundingSourceAddress}`
    );
    let prepaidCardSafe = createPrepaidCardSafe({
      address: cardAddress,
      createdAt: Math.floor(Date.now() / 1000),
      owners: [walletAddress],
      spendFaceValue: faceValue,
      prepaidCardOwner: walletAddress,
      issuer: walletAddress,
      customizationDID: request?.customizationDID,
      ...options,
    });
    request?.onTxnHash?.('exampleTxnHash');

    this.test__simulateRemoteAccountSafes(walletAddress, [prepaidCardSafe]);
    let unfetchedSource = this.remoteAccountSafes
      .get(this.walletInfo.firstAddress!)!
      .find((v: Safe) => v.address === fundingSourceAddress);

    unfetchedSource!.tokens.forEach((t: TokenInfo) => {
      if (t.token.symbol === 'DAI.CPXD') {
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
    profileSafeAddress: string,
    options: Object
  ) {
    let request = this.registerMerchantRequests.get(prepaidCardAddress);
    let profileSafe: MerchantSafe = createProfileSafe({
      createdAt: Math.floor(Date.now() / 1000),
      address: profileSafeAddress,
      profile: prepaidCardAddress,
      accumulatedSpendValue: 100,
      infoDID: request?.infoDID,
      ...options,
    });
    request?.onTxnHash?.('exampleTxnHash');

    let prepaidCard = this.remoteAccountSafes
      .get(this.walletInfo.firstAddress!)!
      .find((safe) => safe.address === prepaidCardAddress);

    let profileCreationFee = await this.fetchProfileRegistrationFee();

    if (prepaidCard && prepaidCard.type === 'prepaid-card') {
      prepaidCard.spendFaceValue =
        prepaidCard.spendFaceValue - profileCreationFee;
    }

    this.test__simulateRemoteAccountSafes(this.walletInfo.firstAddress!, [
      profileSafe,
    ]);
    return request?.deferred.resolve(profileSafe);
  }

  async test__simulateRegisterMerchantRejectionForAddress(
    prepaidCardAddress: string
  ) {
    let request = this.registerMerchantRequests.get(prepaidCardAddress);
    return request?.deferred.reject(
      new Error('User rejected profile creation')
    );
  }

  test__simulateHubAuthentication(authToken: string) {
    return this.test__deferredHubAuthentication.resolve(authToken);
  }

  async test__simulateBridgedToLayer1(
    safeAddress?: string,
    receiverAddress?: string,
    tokenSymbol?: BridgedTokenSymbol,
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
