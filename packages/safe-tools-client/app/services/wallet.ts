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

const CHAIN_NAME_FIXME = 'mainnet';
const CHAIN_ID_FIXME = 1;

export default class Wallet extends Service {
  @tracked isConnected = false;
  @tracked providerId: WalletProviderId | undefined;
  @tracked address: string | undefined;

  web3 = new Web3();
  chainConnectionManager = new ChainConnectionManager(CHAIN_NAME_FIXME);

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

  constructor() {
    super();

    this.chainConnectionManager.on('connected', (accounts: string[]) => {
      this.isConnected = true;
      this.address = accounts[0];
    });

    const providerId =
      ChainConnectionManager.getProviderIdForChain(CHAIN_ID_FIXME);
    if (providerId !== 'wallet-connect' && providerId !== 'metamask') {
      return;
    }

    this.providerId = providerId;
    this.chainConnectionManager.reconnect(this.web3, this.providerId);
  }

  @action connect(providerId: WalletProviderId) {
    this.providerId = providerId;

    if (!this.isConnected) {
      taskFor(this.connectWalletTask).perform();
    }
  }

  @task *connectWalletTask() {
    if (!this.providerId) {
      return;
    }

    yield this.chainConnectionManager.connect(this.web3, this.providerId);
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
