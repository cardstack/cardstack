import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Web3Strategy } from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';

export default class TestWeb3Strategy implements Web3Strategy {
  chainName = 'Test Chain';
  chainId = '-1';
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
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
