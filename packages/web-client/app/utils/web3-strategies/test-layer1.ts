import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer1Web3Strategy, TransactionHash } from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';
import BN from 'bn.js';
import { WalletProvider } from '../wallet-providers';
import { TransactionReceipt } from 'web3-core';
import {
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';

export default class TestLayer1Web3Strategy implements Layer1Web3Strategy {
  chainName = 'L1 test chain';
  chainId = -1;
  @tracked currentProviderId: string | undefined;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  simpleEmitter = new SimpleEmitter();

  // Balances are settable in this test implementation
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;

  waitForAccountDeferred = defer();
  #unlockDeferred: RSVP.Deferred<TransactionReceipt> | undefined;
  #depositDeferred: RSVP.Deferred<TransactionReceipt> | undefined;

  // eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-unused-vars
  approve(_amountInWei: BN, _token: string) {
    this.#unlockDeferred = RSVP.defer();
    return this.#unlockDeferred.promise;
  }

  relayTokens(
    _token: string, // eslint-disable-line no-unused-vars
    _destinationAddress: string, // eslint-disable-line no-unused-vars
    _amountInWei: BN // eslint-disable-line no-unused-vars
  ) {
    this.#depositDeferred = RSVP.defer();
    return this.#depositDeferred.promise;
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

  test__simulateBalances(balances: {
    defaultToken: BN | undefined;
    dai: BN | undefined;
    card: BN | undefined;
  }) {
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

  get waitForAccount() {
    return this.waitForAccountDeferred.promise as Promise<void>;
  }
}
