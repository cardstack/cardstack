import Service from '@ember/service';

import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';

import { ChainConnectionManager } from '@cardstack/safe-tools-client/utils/chain-connection-manager';
import walletProviders, {
  WalletProviderId,
} from '@cardstack/safe-tools-client/utils/wallet-providers';
import Web3 from 'web3';
import { timeout } from 'ember-concurrency';

export default class Wallet extends Service {
  @tracked isConnected = false;
  @tracked providerId: WalletProviderId | undefined;

  chainConnectionManager = new ChainConnectionManager('mainnet'); // FIXME generalise
  walletProviders = walletProviders.map((w) =>
    w.id === 'metamask'
      ? {
          ...w,
          enabled: !!window.ethereum?.isMetaMask,
          explanation: window.ethereum?.isMetaMask
            ? ''
            : 'MetaMask extension not detected',
        }
      : { ...w, enabled: true, explanation: '' }
  );

  @action connect() {
    this.chainConnectionManager.on('connected', (accounts: string[]) => {
      console.log('connected', accounts);
    });
    if (!this.isConnected) {
      taskFor(this.connectWalletTask).perform();
    }
  }

  @task *connectWalletTask() {
    const web3 = new Web3();
    yield this.chainConnectionManager.connect(web3, this.providerId!);
    yield timeout(500); // allow time for strategy to verify connected chain -- it might not accept the connection
  }

  get isConnecting() {
    return taskFor(this.connectWalletTask).isRunning;
  }

  @action cancelConnection() {
    // TODO
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    wallet: Wallet;
  }
}
