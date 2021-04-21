import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer1Web3Strategy } from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';
import { BigNumber } from '@ethersproject/bignumber';
import { WalletProvider } from '../wallet-providers';

export default class TestLayer1Web3Strategy implements Layer1Web3Strategy {
  chainName = 'L1 Test Chain';
  chainId = -1;
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);

  // Balances are settable in this test implementation
  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: BigNumber | undefined;
  @tracked cardBalance: BigNumber | undefined;

  waitForAccountDeferred = defer();
  #unlockDeferred: RSVP.Deferred<void> | undefined;
  #depositDeferred: RSVP.Deferred<void> | undefined;

  // eslint-disable-next-line no-unused-vars
  connect(_walletProvider: WalletProvider): Promise<void> {
    return this.waitForAccount;
  }

  unlock() {
    this.#unlockDeferred = RSVP.defer();
    return this.#unlockDeferred.promise;
  }

  deposit() {
    this.#depositDeferred = RSVP.defer();
    return this.#depositDeferred.promise;
  }

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[]) {
    this.isConnected = true;
    this.walletInfo = new WalletInfo(accounts, this.chainId);
    this.waitForAccountDeferred.resolve();
  }

  test__simulateUnlock() {
    this.#unlockDeferred?.resolve();
  }

  test__simulateDeposit() {
    this.#depositDeferred?.resolve();
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise as Promise<void>;
  }
}
