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
  chainId = -1;
  @tracked currentProviderId: string | undefined;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  simpleEmitter = new SimpleEmitter();

  // property to test whether the refreshBalances method is called
  // to test if balances are refreshed after relaying tokens
  // this is only a mock property
  @tracked balancesRefreshed = false;

  // Balances are settable in this test implementation
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;

  waitForAccountDeferred = defer();
  #unlockDeferred: RSVP.Deferred<TransactionReceipt> | undefined;
  #depositDeferred: RSVP.Deferred<TransactionReceipt> | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  approve(_amountInWei: BN, _token: string) {
    this.#unlockDeferred = RSVP.defer();
    return this.#unlockDeferred.promise;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  relayTokens(_token: string, _destinationAddress: string, _amountInWei: BN) {
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
