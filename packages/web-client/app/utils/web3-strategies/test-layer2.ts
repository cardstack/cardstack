import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer2Web3Strategy } from './types';
import { defer } from 'rsvp';
import RSVP from 'rsvp';
import { BigNumber } from '@ethersproject/bignumber';

export default class TestWeb3Strategy implements Layer2Web3Strategy {
  chainName = 'L2 Test Chain';
  chainId = '-1';
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  waitForAccountDeferred = defer();
  @tracked defaultTokenBalance: BigNumber | undefined;
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

  test__simulateBalances(balances: { defaultToken: BigNumber | undefined }) {
    if (balances.defaultToken) {
      this.defaultTokenBalance = balances.defaultToken;
    }
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
