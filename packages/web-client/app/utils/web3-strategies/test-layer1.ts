import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer1Web3Strategy, TransactionHash } from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';
import { BigNumber } from '@ethersproject/bignumber';
import { WalletProvider } from '../wallet-providers';
import { TransactionReceipt } from 'web3-core';

export default class TestLayer1Web3Strategy implements Layer1Web3Strategy {
  chainName = 'L1 Test Chain';
  chainId = -1;
  @tracked currentProviderId: string | undefined;
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);

  // Balances are settable in this test implementation
  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: BigNumber | undefined;
  @tracked cardBalance: BigNumber | undefined;

  waitForAccountDeferred = defer();
  #unlockDeferred: RSVP.Deferred<TransactionReceipt> | undefined;
  #depositDeferred: RSVP.Deferred<TransactionReceipt> | undefined;

  // eslint-disable-next-line no-unused-vars
  connect(_walletProvider: WalletProvider): Promise<void> {
    return this.waitForAccount;
  }

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([]);
    return this.waitForAccount;
  }

  // eslint-disable-next-line no-unused-vars
  approve(_amountInWei: BigNumber, _token: string) {
    this.#unlockDeferred = RSVP.defer();
    return this.#unlockDeferred.promise;
  }

  relayTokens(
    _amountInWei: BigNumber, // eslint-disable-line no-unused-vars
    _token: string, // eslint-disable-line no-unused-vars
    _destinationAddress: string // eslint-disable-line no-unused-vars
  ) {
    this.#depositDeferred = RSVP.defer();
    return this.#depositDeferred.promise;
  }

  txnViewerUrl(txnHash: TransactionHash): string {
    return `https://www.youtube.com/watch?v=xvFZjo5PgG0&txnHash=${txnHash}`;
  }

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[], walletProviderId?: string) {
    if (accounts.length && walletProviderId) {
      this.isConnected = true;
      this.currentProviderId = walletProviderId;
      this.walletInfo = new WalletInfo(accounts, this.chainId);
      this.waitForAccountDeferred.resolve();
    } else {
      this.isConnected = false;
      this.currentProviderId = '';
      this.walletInfo = new WalletInfo([], this.chainId);
      this.waitForAccountDeferred.resolve();
    }
  }

  test__simulateBalances(balances: {
    defaultToken: BigNumber | undefined;
    dai: BigNumber | undefined;
    card: BigNumber | undefined;
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
