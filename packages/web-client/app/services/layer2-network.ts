import Service from '@ember/service';
import config from '../config/environment';
import { Web3Strategy } from '../utils/web3-strategies/types';
import TestWeb3Strategy from '../utils/web3-strategies/test';
import XDaiWeb3Strategy from '../utils/web3-strategies/x-dai';
import SokolWeb3Strategy from '../utils/web3-strategies/sokol';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';

export default class Layer2Network extends Service {
  strategy!: Web3Strategy;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', []) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;
  @reads('strategy.chainName') chainName!: string;

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer2) {
      case 'xdai':
        this.strategy = new XDaiWeb3Strategy();
        break;
      case 'sokol':
        this.strategy = new SokolWeb3Strategy();
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
    'layer2-network': Layer2Network;
  }
}
