import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class Layer2Network extends Service {
  @tracked isConnected = false;
  @tracked walletConnectUri: string | undefined;
  @tracked accounts: string[] = [];

  get hasAccount() {
    return this.accounts.length > 0;
  }

  test__simulateConnected() {
    this.walletConnectUri = 'This is a test of Layer2 Wallet Connect';
    this.isConnected = true;
  }

  test__simulateAccountsChanged(accounts: string[]) {
    this.accounts = accounts;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  // eslint-disable-next-line no-unused-vars
  interface Registry {
    'layer2-network': Layer2Network;
  }
}
