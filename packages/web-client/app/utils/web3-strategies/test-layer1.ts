import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import {
  ApproveOptions,
  Layer1Web3Strategy,
  TransactionHash,
  ClaimBridgedTokensOptions,
  RelayTokensOptions,
  TxnBlockNumber,
} from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';
import BN from 'bn.js';
import { WalletProvider } from '../wallet-providers';
import { TransactionReceipt } from 'web3-core';
import { BridgeValidationResult } from '@cardstack/cardpay-sdk';
import {
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';
import { toWei } from 'web3-utils';

interface ClaimBridgedTokensRequest {
  deferred: RSVP.Deferred<TransactionReceipt>;
  onTxHash?: (txHash: TransactionHash) => void;
}

export default class TestLayer1Web3Strategy implements Layer1Web3Strategy {
  chainId = -1;
  bridgeConfirmationBlockCount = 5;
  @tracked isInitializing = false;
  @tracked currentProviderId: string | undefined;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  simpleEmitter = new SimpleEmitter();
  minimumBalanceForWithdrawalClaim = 0.01;

  // property to test whether the refreshBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  // Balances are settable in this test implementation
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;

  waitForAccountDeferred = defer();
  #unlockOnTxHash: Function | undefined;
  #unlockDeferred: RSVP.Deferred<TransactionReceipt> | undefined;
  #depositOnTxHash: Function | undefined;
  #depositDeferred: RSVP.Deferred<TransactionReceipt> | undefined;
  claimBridgedTokensRequests: Map<
    string,
    ClaimBridgedTokensRequest
  > = new Map();
  blockConfirmationDeferred!: RSVP.Deferred<void>;

  connect(_walletProvider: WalletProvider): Promise<void> {
    return this.waitForAccount;
  }

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([], '');
    this.simpleEmitter.emit('disconnect');
    return this.waitForAccount;
  }

  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  test__simulateDisconnectFromWallet() {
    this.disconnect();
  }

  approve(_amountInWei: BN, _token: string, { onTxHash }: ApproveOptions) {
    this.#unlockOnTxHash = onTxHash;
    this.#unlockDeferred = RSVP.defer();
    return this.#unlockDeferred.promise;
  }

  relayTokens(
    _token: string,
    _destinationAddress: string,
    _amountInWei: BN,
    { onTxHash }: RelayTokensOptions
  ) {
    this.#depositOnTxHash = onTxHash;
    this.#depositDeferred = RSVP.defer();
    return this.#depositDeferred.promise;
  }

  refreshBalances() {
    this.balancesRefreshed = true;
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[], walletProviderId?: string) {
    if (accounts.length && walletProviderId) {
      this.currentProviderId = walletProviderId;
      this.walletInfo = new WalletInfo(accounts, this.chainId);
      this.waitForAccountDeferred.resolve();
    } else {
      this.currentProviderId = '';
      this.walletInfo = new WalletInfo([], this.chainId);
      this.waitForAccountDeferred.resolve();
    }
  }

  get isConnected() {
    return this.walletInfo.accounts.length > 0;
  }

  test__simulateBalances(balances: { defaultToken?: BN; dai?: BN; card?: BN }) {
    if (balances.defaultToken) {
      this.defaultTokenBalance = balances.defaultToken;
    }
    if (balances.dai) {
      this.daiBalance = balances.dai;
    }
    if (balances.card) {
      this.cardBalance = balances.card;
    }
  }

  test__simulateUnlockTxHash() {
    this.#unlockOnTxHash?.('0xABC');
  }

  test__simulateUnlock() {
    this.#unlockDeferred?.resolve({
      status: true,
      transactionHash: '0xABC',
      transactionIndex: 1,
      blockHash: '',
      blockNumber: 1,
      from: '',
      to: '',
      contractAddress: '',
      cumulativeGasUsed: 1,
      gasUsed: 1,
      logs: [],
      logsBloom: '',
      events: {},
    });
  }

  test__simulateDepositTxHash() {
    this.#depositOnTxHash?.('0xDEF');
  }

  test__simulateDeposit() {
    this.#depositDeferred?.resolve({
      status: true,
      transactionHash: '0xDEF',
      transactionIndex: 1,
      blockHash: '',
      blockNumber: 1,
      from: '',
      to: '',
      contractAddress: '',
      cumulativeGasUsed: 1,
      gasUsed: 1,
      logs: [],
      logsBloom: '',
      events: {},
    });
  }

  async claimBridgedTokens(
    bridgeValidationResult: BridgeValidationResult,
    options?: ClaimBridgedTokensOptions
  ): Promise<TransactionReceipt> {
    let deferred: RSVP.Deferred<TransactionReceipt> = defer();
    this.claimBridgedTokensRequests.set(bridgeValidationResult.messageId, {
      deferred,
      onTxHash: options?.onTxHash,
    });
    return deferred.promise;
  }

  test__simulateBridgedTokensClaimed(messageId: string) {
    let request = this.claimBridgedTokensRequests.get(messageId);
    request?.onTxHash?.('exampleTxHash');
    return request?.deferred.resolve({} as TransactionReceipt);
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise as Promise<void>;
  }

  getBlockConfirmation(blockNumber: TxnBlockNumber): Promise<void> {
    if (blockNumber > 1 && blockNumber < this.bridgeConfirmationBlockCount) {
      return Promise.resolve();
    } else {
      this.blockConfirmationDeferred = defer<void>();
      return this.blockConfirmationDeferred.promise as Promise<void>;
    }
  }

  test__simulateBlockConfirmation() {
    this.blockConfirmationDeferred.resolve();
  }

  async getEstimatedGasForWithdrawalClaim(): Promise<BN> {
    return Promise.resolve(new BN(290000).mul(new BN(toWei('48', 'gwei'))));
  }
}
