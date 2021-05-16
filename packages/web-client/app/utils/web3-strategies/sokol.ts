const BRIDGE = 'https://safe-walletconnect.gnosis.io/';
import CustomStorageWalletConnect from '../wc-connector';
import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3 from 'web3';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import {
  ChainAddress,
  ConversionFunction,
  ConvertibleSymbol,
  Layer2Web3Strategy,
  TransactionHash,
} from './types';
import { IConnector } from '@walletconnect/types';
import WalletInfo from '../wallet-info';
import { defer, hash } from 'rsvp';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import {
  networkIds,
  getConstantByNetwork,
  TokenBridgeHomeSide,
  Safes,
  DepotSafe,
  ExchangeRate,
} from '@cardstack/cardpay-sdk';
export default class SokolWeb3Strategy implements Layer2Web3Strategy {
  chainName = 'Sokol Testnet';
  chainId = networkIds['sokol'];
  provider: WalletConnectProvider | undefined;

  @reads('provider.connector') connector!: IConnector;
  @tracked isConnected = false;
  @tracked walletConnectUri: string | undefined;
  @tracked walletInfo = new WalletInfo([], this.chainId) as WalletInfo;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked waitForAccountDeferred = defer();
  web3!: Web3;
  #exchangeRateApi!: ExchangeRate;

  constructor() {
    // super(...arguments);
    this.initialize();
  }

  async initialize() {
    this.provider = new WalletConnectProvider({
      chainId: this.chainId,
      rpc: {
        [networkIds['sokol']]: getConstantByNetwork('rpcNode', 'sokol'),
      },
      connector: new CustomStorageWalletConnect(
        {
          bridge: BRIDGE,
        },
        this.chainId
      ),
    });
    this.connector.on('display_uri', (err, payload) => {
      if (err) {
        console.error('Error in display_uri callback', err);
        return;
      }
      this.walletConnectUri = payload.params[0];
    });
    let strategy = this;
    this.provider.on('chainChanged', (chainId: number) => {
      if (String(chainId) !== String(networkIds['sokol'])) {
        console.log(`Layer2 WC chainChanged to ${chainId}. Disconnecting`);
        strategy.disconnect();
      }
    });
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
    await this.provider.enable();
    this.web3 = new Web3(this.provider as any);
    this.#exchangeRateApi = new ExchangeRate(this.web3);
    this.isConnected = true;
    this.updateWalletInfo(this.connector.accounts, this.connector.chainId);
  }

  updateWalletInfo(accounts: string[], chainId: number) {
    let newWalletInfo = new WalletInfo(accounts, chainId);
    if (this.walletInfo.isEqualTo(newWalletInfo)) {
      return;
    }
    this.walletInfo = newWalletInfo;
    if (accounts.length) {
      this.refreshBalances();
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], this.chainId);
  }

  get waitForAccount() {
    return this.waitForAccountDeferred.promise;
  }

  async refreshBalances() {
    let raw = await this.getDefaultTokenBalance();
    this.defaultTokenBalance = toBN(String(raw ?? 0));
  }

  async getDefaultTokenBalance() {
    if (this.walletInfo.firstAddress)
      return await this.web3.eth.getBalance(
        this.walletInfo.firstAddress,
        'latest'
      );
    else return 0;
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

  async disconnect(): Promise<void> {
    await this.provider?.disconnect();
    this.clearWalletInfo();
  }

  async updateUsdConverters(
    symbolsToUpdate: ConvertibleSymbol[]
  ): Promise<Record<ConvertibleSymbol, ConversionFunction>> {
    let promisesHash = {} as Record<
      ConvertibleSymbol,
      Promise<ConversionFunction>
    >;
    for (let symbol of symbolsToUpdate) {
      promisesHash[symbol] = this.#exchangeRateApi.getUSDConverter(symbol);
    }
    return hash(promisesHash);
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork('blockExplorer', 'sokol')}/tx/${txnHash}`;
  }

  async getBlockHeight(): Promise<BN> {
    const result = await this.web3.eth.getBlockNumber();
    return toBN(result);
  }
}
