import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer2Web3Strategy } from './types';
import RSVP, { defer } from 'rsvp';
import {
  UnbindEventListener,
  SimpleEmitter,
} from '@cardstack/ssr-web/utils/events';
import { task, TaskGenerator } from 'ember-concurrency';

export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainId = '-1';
  simpleEmitter = new SimpleEmitter();
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo: WalletInfo = new WalletInfo([]);
  waitForAccountDeferred = defer();
  @tracked isInitializing = false;

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

  get isConnected() {
    return this.walletInfo.accounts.length > 0;
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  authenticate(): Promise<string> {
    this.test__deferredHubAuthentication = defer();
    return this.test__deferredHubAuthentication.promise;
  }

  checkHubAuthenticationValid(_authToken: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  test__deferredHubAuthentication!: RSVP.Deferred<string>;

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
    await this.waitForAccountDeferred.resolve();
  }

  test__simulateHubAuthentication(authToken: string) {
    return this.test__deferredHubAuthentication.resolve(authToken);
  }
}
