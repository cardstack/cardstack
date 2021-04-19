import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer1Web3Strategy } from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';

export default class TestLayer1Web3Strategy implements Layer1Web3Strategy {
  chainName = 'L1 Test Chain';
  chainId = -1;
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);

  // Balances are settable in this test implementation
  @tracked defaultTokenBalance: number | undefined;
  @tracked daiBalance: number | undefined;
  @tracked cardBalance: number | undefined;

  waitForAccountDeferred = defer();
  #unlockDeferred: RSVP.Deferred<void> | undefined;
  #depositDeferred: RSVP.Deferred<void> | undefined;

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
    this.walletInfo = new WalletInfo(accounts, parseInt(this.chainId, 10));
    this.waitForAccountDeferred.resolve();
  }

  test__simulateUnlock() {
    this.#unlockDeferred?.resolve();
  }

  test__simulateDeposit() {
    this.#depositDeferred?.resolve();
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }
}
