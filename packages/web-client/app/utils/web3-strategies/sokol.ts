const BRIDGE = 'https://safe-walletconnect.gnosis.io/';
import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3 from 'web3';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { Web3Strategy } from './types';
import { IConnector } from '@walletconnect/types';
import WalletInfo from '../wallet-info';
import { defer } from 'rsvp';

export default class SokolWeb3Strategy implements Web3Strategy {
  chainName = 'Sokol Testnet';
  chainId = 77;
  provider = new WalletConnectProvider({
    bridge: BRIDGE,
    chainId: this.chainId,
    rpc: {
      77: 'https://sokol.poa.network',
    },
    qrcode: false,
  });

  @reads('provider.connector') connector!: IConnector;
  @tracked isConnected = false;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo = { accounts: [], chainId: -1 } as WalletInfo;
  waitForAccountDeferred = defer();
  web3!: Web3;

  constructor() {
    // super(...arguments);
    this.initialize();
  }
  unlock(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deposit(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async initialize() {
    this.connector.on('display_uri', (err, payload) => {
      if (err) {
        console.error('Error in display_uri callback', err);
        return;
      }
      this.walletConnectUri = payload.params[0];
    });
    await this.provider.enable();
    this.web3 = new Web3(this.provider as any);
    this.isConnected = true;
    // this.initializePayableToken();
    this.updateWalletInfo(this.connector.accounts, this.connector.chainId);
    this.connector.on('session_update', (error, payload) => {
      if (error) {
        throw error;
      }
      let { accounts, chainId } = payload.params[0];
      if (chainId !== this.chainId) {
        throw new Error(
          `Expected connection on ${this.chainName} (chain ID ${this.chainId}) but connected to chain ID ${chainId}`
        );
      }
      this.updateWalletInfo(accounts, chainId);
    });

    this.connector.on('disconnect', (error) => {
      if (error) {
        console.error('error disconnecting', error);
        throw error;
      }
      this.isConnected = false;
      this.clearWalletInfo();
      this.walletConnectUri = undefined;
      setTimeout(() => {
        this.initialize();
      }, 1000);
    });
  }

  updateWalletInfo(accounts: string[], chainId: number) {
    if (accounts.length) {
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
    this.walletInfo = new WalletInfo(accounts, chainId);
  }

  clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }
}
