import {
  isSupportedChain,
  getConstantByNetwork,
  getSDK,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import { ChainConnectionManager } from '@cardstack/safe-tools-client/utils/chain-connection-manager';
import walletProviders, {
  WalletProviderId,
} from '@cardstack/safe-tools-client/utils/wallet-providers';

import { action } from '@ember/object';
import type { default as Owner } from '@ember/owner';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { timeout } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';

import Web3 from 'web3';

export default class Wallet extends Service {
  @service declare network: NetworkService;

  @tracked isConnected = false;
  @tracked providerId: WalletProviderId | undefined;
  @tracked address: string | undefined;
  @tracked isConnecting = false;

  @tracked nativeTokenBalance: Record<'symbol' | 'amount', string> | undefined;

  // TODO: replace with ethers
  web3 = new Web3();
  chainConnectionManager: ChainConnectionManager;

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

  constructor(owner: Owner) {
    super(owner);

    this.chainConnectionManager = new ChainConnectionManager(
      this.network.symbol,
      this.network.chainId,
      owner
    );
    this.chainConnectionManager.on('connected', (accounts: string[]) => {
      this.isConnected = true;
      this.address = accounts[0];
    });

    this.chainConnectionManager.on('disconnected', () => {
      this.isConnected = false;
    });

    this.chainConnectionManager.on('chain-changed', (chainId: number) => {
      if (!isSupportedChain(chainId)) {
        // TODO: improve unsupported net handling
        alert('Unsupported network! Choose a supported one and reconnect');
        this.disconnect();
        return;
      }
      this.network.onChainChanged(chainId);
    });

    const providerId = this.chainConnectionManager.getProviderIdForChain(
      this.network.chainId
    );
    if (providerId !== 'wallet-connect' && providerId !== 'metamask') {
      return;
    }

    this.providerId = providerId;
    this.chainConnectionManager.reconnect(this.web3, this.providerId);
  }

  @action connect(providerId: WalletProviderId, onConnectSuccess: () => void) {
    this.providerId = providerId;

    if (!this.isConnected) {
      this.isConnecting = true;
      taskFor(this.connectWalletTask)
        .perform()
        .then(() => {
          if (this.isConnected) {
            onConnectSuccess();
          }
        })
        .catch((e) => {
          console.log(e);
        });
    }
  }

  @task *connectWalletTask() {
    if (!this.providerId) {
      return;
    }

    yield this.chainConnectionManager.connect(this.web3, this.providerId);
    yield timeout(500); // allow time for strategy to verify connected chain -- it might not accept the connection

    this.isConnecting = false;
  }

  @action cancelConnection() {
    this.isConnecting = false;
  }

  @action disconnect() {
    this.chainConnectionManager.disconnect();
  }

  @action async fetchNativeTokenBalance() {
    const assets = await getSDK('Assets', this.web3);
    const balance = await assets.getNativeTokenBalance(this.address);
    this.nativeTokenBalance = {
      symbol: getConstantByNetwork('nativeTokenSymbol', this.network.symbol),
      amount: balance || '0',
    };

    return this.nativeTokenBalance;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    wallet: Wallet;
  }
}
