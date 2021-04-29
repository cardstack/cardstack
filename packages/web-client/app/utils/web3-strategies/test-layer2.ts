import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Layer2Web3Strategy } from './types';
import { defer } from 'rsvp';
import { BigNumber } from '@ethersproject/bignumber';

export default class TestLayer2Web3Strategy implements Layer2Web3Strategy {
  chainName = 'L2 Test Chain';
  chainId = '-1';
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);
  waitForAccountDeferred = defer();
  @tracked defaultTokenBalance: BigNumber | undefined;

  disconnect(): Promise<void> {
    this.test__simulateAccountsChanged([]);
    return this.waitForAccount as Promise<void>;
  }

  getBlockHeight(): Promise<BigNumber> {
    return Promise.resolve(BigNumber.from(0));
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

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }
}
