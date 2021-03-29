import { tracked } from '@glimmer/tracking';
import WalletInfo from '../wallet-info';
import { Web3Strategy } from './types';

export default class TestWeb3Strategy implements Web3Strategy {
  @tracked walletConnectUri: string | undefined;
  @tracked isConnected = false;
  @tracked walletInfo: WalletInfo = new WalletInfo([], -1);

  test__simulateWalletConnectUri() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
  }

  test__simulateAccountsChanged(accounts: string[]) {
    this.isConnected = true;
    this.walletInfo = new WalletInfo(accounts, 0);
  }
}
