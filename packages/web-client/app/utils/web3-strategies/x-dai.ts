const BRIDGE = 'https://safe-walletconnect.gnosis.io/';
import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3 from 'web3';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { ChainAddress, Layer2Web3Strategy, TransactionHash } from './types';
import {
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import { IConnector } from '@walletconnect/types';
import WalletInfo from '../wallet-info';
import { defer } from 'rsvp';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import {
  networkIds,
  getConstantByNetwork,
  TokenBridgeHomeSide,
} from '@cardstack/cardpay-sdk';
import { Safes, DepotSafe } from '@cardstack/cardpay-sdk';
import { UnbindEventListener } from '@cardstack/web-client/utils/events';

export default class XDaiWeb3Strategy implements Layer2Web3Strategy {
  chainName = 'xDai chain';
  chainId = networkIds['xdai'];
  provider = new WalletConnectProvider({
    bridge: BRIDGE,
    chainId: this.chainId,
    rpc: {
      [networkIds['xdai']]: getConstantByNetwork('rpcNode', 'xdai'),
    },
    qrcode: false,
  });

  @reads('provider.connector') connector!: IConnector;
  @tracked isConnected = false;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo = new WalletInfo([], this.chainId);
  waitForAccountDeferred = defer();
  web3!: Web3;

  constructor() {
    // super(...arguments);
    this.initialize();
  }

  @tracked defaultTokenBalance: BN | undefined;

  disconnect(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line no-unused-vars
  on(event: string, cb: Function): UnbindEventListener {
    throw new Error('Method not implemented');
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
    this.walletInfo = new WalletInfo(accounts, chainId);
    if (accounts.length > 0) {
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork('blockExplorer', 'xdai')}/tx/${txnHash}`;
  }

  async getBlockHeight(): Promise<BN> {
    const result = await this.web3.eth.getBlockNumber();
    return toBN(result);
  }

  awaitBridged(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt> {
    let tokenBridge = new TokenBridgeHomeSide(this.web3);
    return tokenBridge.waitForBridgingCompleted(receiver, fromBlock);
  }

  async fetchDepot(owner: ChainAddress): Promise<DepotSafe | null> {
    let safesApi = new Safes(this.web3);
    let safes = await safesApi.view(owner);
    let depotSafes = safes.filter(
      (safe) => safe.type === 'depot'
    ) as DepotSafe[];
    if (depotSafes.length) {
      return depotSafes[depotSafes.length - 1];
    }
    return null;
  }

  async updateUsdConverters(
    _symbolsToUpdate: ConvertibleSymbol[] // eslint-disable-line no-unused-vars
  ): Promise<Record<ConvertibleSymbol, ConversionFunction>> {
    throw new Error(`Method not implemented.`);
  }
}
