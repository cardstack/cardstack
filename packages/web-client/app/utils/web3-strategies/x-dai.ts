const BRIDGE = 'https://safe-walletconnect.gnosis.io/';
import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3 from 'web3';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { Web3Strategy } from './types';
import { IConnector } from '@walletconnect/types';
import WalletInfo from '../wallet-info';

export default class XDaiWeb3Strategy implements Web3Strategy {
  provider = new WalletConnectProvider({
    bridge: BRIDGE,
    rpc: {
      100: 'https://dai.poa.network',
    },
    qrcode: false,
  });

  @reads('provider.connector') connector!: IConnector;
  @tracked isConnected = false;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo = { accounts: [], chainId: -1 } as WalletInfo;
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
      this.updateWalletInfo(accounts, chainId);
    });

    this.connector.on('disconnect', (error) => {
      if (error) {
        console.log('error disconnecting', error);
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
    this.walletInfo = new WalletInfo(accounts, chainId);
  }

  clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }
}
