import Service from '@ember/service';
import config from '../config/environment';
import { Web3Strategy } from '../utils/web3-strategies/types';
import TestWeb3Strategy from '../utils/web3-strategies/test';
import EthWeb3Strategy from '../utils/web3-strategies/ethereum';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';

export default class Layer1Network extends Service {
  strategy!: Web3Strategy;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', []) walletInfo!: WalletInfo;

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer1) {
      case 'eth':
        this.strategy = new EthWeb3Strategy();
        break;
      case 'test':
        this.strategy = new TestWeb3Strategy();
        break;
    }
  }

  get hasAccount() {
    return this.walletInfo.accounts.length > 0;
  }

  test__simulateWalletConnectUri() {
    let strategy = this.strategy as TestWeb3Strategy;
    strategy.test__simulateWalletConnectUri();
  }

  test__simulateAccountsChanged(accounts: string[]) {
    let strategy = this.strategy as TestWeb3Strategy;
    strategy.test__simulateAccountsChanged(accounts);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  // eslint-disable-next-line no-unused-vars
  interface Registry {
    'layer1-network': Layer1Network;
  }
}
