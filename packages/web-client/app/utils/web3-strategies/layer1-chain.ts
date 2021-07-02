import { tracked } from '@glimmer/tracking';
import { defer } from 'rsvp';
import { registerDestructor } from '@ember/destroyable';
import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import detectEthereumProvider from '@metamask/detect-provider';
import WalletConnectProvider from '@walletconnect/web3-provider';
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal';

import config from '../../config/environment';
import { SimpleEmitter, UnbindEventListener } from '../events';
import { BridgeableSymbol, TokenContractInfo } from '../token';
import WalletInfo from '../wallet-info';
import { WalletProvider } from '../wallet-providers';
import CustomStorageWalletConnect from '../wc-connector';
import {
  Layer1Web3Strategy,
  TransactionHash,
  Layer1NetworkSymbol,
} from './types';
import {
  getConstantByNetwork,
  getSDK,
  networkIds,
} from '@cardstack/cardpay-sdk';
import { networkDisplayInfo } from './network-display-info';

const WALLET_CONNECT_BRIDGE = 'https://safe-walletconnect.gnosis.io/';

export default abstract class Layer1ChainWeb3Strategy
  implements Layer1Web3Strategy {
  private chainName: string;
  chainId: number;
  networkSymbol: Layer1NetworkSymbol;
  web3 = new Web3();
  broadcastChannel: BroadcastChannel;
  cardTokenContract: Contract;
  daiTokenContract: Contract;
  bridgeableTokens: TokenContractInfo[];
  simpleEmitter = new SimpleEmitter();

  // changes with connection state
  provider: any | undefined;
  #waitForAccountDeferred = defer<void>();
  @tracked currentProviderId: string | undefined;
  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  @tracked walletInfo: WalletInfo;

  constructor(networkSymbol: Layer1NetworkSymbol) {
    this.chainName = networkDisplayInfo[networkSymbol].fullName;
    this.chainId = networkIds[networkSymbol];
    this.walletInfo = new WalletInfo([], this.chainId);
    this.networkSymbol = networkSymbol;
    let cardTokenContractInfo = this.getTokenContractInfo(
      'CARD',
      networkSymbol
    );
    let daiTokenContractInfo = this.getTokenContractInfo('DAI', networkSymbol);

    this.cardTokenContract = new this.web3.eth.Contract(
      cardTokenContractInfo.abi,
      cardTokenContractInfo.address
    );
    this.daiTokenContract = new this.web3.eth.Contract(
      daiTokenContractInfo.abi,
      daiTokenContractInfo.address
    );
    this.bridgeableTokens = [cardTokenContractInfo, daiTokenContractInfo];

    // the broadcast channel is really for metamask disconnections
    // since metamask doesn't allow you to disconnect from the dapp side
    // we want to ensure that users don't get confused by different tabs having
    // different wallets connected
    this.broadcastChannel = new BroadcastChannel(this.chainName);
    this.broadcastChannel.onmessage = (event: MessageEvent) => {
      if (event.data === 'disconnected') this.onDisconnect();
    };
    registerDestructor(this, this.broadcastChannel.close);
    this.initialize();
  }

  async initialize() {
    const previousProviderId = window.localStorage.getItem(
      this.providerStorageKey
    );
    try {
      if (previousProviderId === 'metamask') {
        // ping because the disconnect event does not seem to be a reliable way to tell whether there's actually a connection
        // if the user hasn't sent a request after they disconnected at the wallet side,
        // the app might not know that it's disconnected and end up popping up metamask
        let provider: any | undefined = await detectEthereumProvider();
        let accounts = await provider.request({ method: 'eth_accounts' });
        if (!accounts.length) {
          window.localStorage.removeItem(this.providerStorageKey);
          return;
        }
      }

      await this.connect({ id: previousProviderId } as WalletProvider);
    } catch (e) {
      // clean up if anything goes wrong.
      this.clearLocalConnectionState();
    }
  }

  private getTokenContractInfo(
    symbol: BridgeableSymbol,
    network: Layer1NetworkSymbol
  ): TokenContractInfo {
    return new TokenContractInfo(symbol, network);
  }

  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }

  on(event: string, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }

  async refreshBalances() {
    let balances = await Promise.all<string>([
      this.getDefaultTokenBalance(),
      this.getErc20Balance(this.daiTokenContract),
      this.getErc20Balance(this.cardTokenContract),
    ]);
    let [defaultTokenBalance, daiBalance, cardBalance] = balances;
    this.defaultTokenBalance = new BN(defaultTokenBalance);
    this.daiBalance = new BN(daiBalance);
    this.cardBalance = new BN(cardBalance);
  }

  private getErc20Balance(contract: Contract) {
    return contract.methods.balanceOf(this.walletInfo.firstAddress).call();
  }

  private async getDefaultTokenBalance() {
    if (this.walletInfo.firstAddress)
      return await this.web3.eth.getBalance(
        this.walletInfo.firstAddress,
        'latest'
      );
    else return 0;
  }

  async connect(walletProvider: WalletProvider): Promise<void> {
    if (walletProvider.id === 'metamask') {
      this.provider = await this.setupMetamask();
      if (!this.provider) {
        return;
      }
      this.web3.setProvider(this.provider);
      let accounts = await this.provider.request({
        method: 'eth_requestAccounts',
      });
      this.updateWalletInfo(accounts, this.chainId);
      this.currentProviderId = walletProvider.id;
      window.localStorage.setItem(this.providerStorageKey, walletProvider.id);
    } else if (walletProvider.id === 'wallet-connect') {
      this.provider = this.setupWalletConnect();
      this.web3.setProvider(this.provider);
      await this.provider.enable();
      if (!this.isConnected) {
        return;
      }
      let accounts = await this.web3.eth.getAccounts();
      this.updateWalletInfo(accounts, this.chainId);
      this.currentProviderId = walletProvider.id;
      window.localStorage.setItem(this.providerStorageKey, walletProvider.id);
    }
  }

  private get providerStorageKey(): string {
    return `cardstack-chain-${this.chainId}-provider`;
  }

  private updateWalletInfo(accounts: string[], chainId: number) {
    this.walletInfo = new WalletInfo(accounts, chainId);
    if (accounts.length > 0) {
      this.refreshBalances();
      this.#waitForAccountDeferred.resolve();
    } else {
      this.#waitForAccountDeferred = defer();
    }
  }

  private async setupMetamask() {
    let provider: any | undefined = await detectEthereumProvider();
    if (!provider) {
      // TODO: some UI prompt for getting people to setup metamask
      console.log('Please install MetaMask!');
      return;
    }

    if (provider !== window.ethereum) {
      // TODO: some UI prompt to get people to disconnect their other wallets
      console.error('Do you have multiple wallets installed?');
      return;
    }

    provider.on('accountsChanged', (accounts: string[]) => {
      if (!accounts.length) {
        this.onDisconnect();
      } else {
        this.updateWalletInfo(accounts, this.chainId);
      }
    });

    // Subscribe to chainId change
    provider.on('chainChanged', (chainId: number) => {
      console.log('Layer1 MM chainChanged', chainId);
    });

    // Subscribe to provider connection
    provider.on('connect', (info: { chainId: number }) => {
      console.log(info);
    });

    // Subscribe to provider disconnection
    // MetaMask doesn't use disconnect the same way WalletConnect does
    // If you disconnect via the wallet, the 'accountsChanged' event is where
    // the Dapp is notified. Disconnect is for other unforeseen stuff
    provider.on('disconnect', (error: { code: number; message: string }) => {
      console.log(error);
      this.onDisconnect();
    });

    return provider;
  }

  private onDisconnect() {
    if (this.isConnected) {
      this.clearLocalConnectionState();
      this.simpleEmitter.emit('disconnect');
      this.broadcastChannel.postMessage('disconnected');
    }
  }

  private clearLocalConnectionState() {
    this.clearWalletInfo();
    this.provider = undefined;
    this.web3.setProvider(this.provider);
    this.currentProviderId = '';
    window.localStorage.removeItem(this.providerStorageKey);
  }

  private clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }

  async disconnect(): Promise<void> {
    // re: disconnecting from metamask
    // There is a solution in https://github.com/MetaMask/metamask-extension/issues/8990
    // that just makes the site think that the wallet isn't connected
    // It actually still is, you can see this when you open the wallet
    // The metamask team believes you should be disconnecting via the extension
    // and has not exposed any way to do this from a dapp
    if (this.currentProviderId === 'wallet-connect') {
      await this.provider.disconnect();
    } else {
      this.onDisconnect();
    }
  }

  private setupWalletConnect(): any {
    let { chainId } = this;
    let provider = new WalletConnectProvider({
      chainId,
      infuraId: config.infuraId,
      // based on https://github.com/WalletConnect/walletconnect-monorepo/blob/7aa9a7213e15489fa939e2e020c7102c63efd9c4/packages/providers/web3-provider/src/index.ts#L47-L52
      connector: new CustomStorageWalletConnect(
        {
          bridge: WALLET_CONNECT_BRIDGE,
          qrcodeModal: WalletConnectQRCodeModal,
        },
        chainId
      ),
    });

    // Subscribe to accounts change
    provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length) this.updateWalletInfo(accounts, chainId);
    });

    // Subscribe to chainId change
    let strategy = this;
    provider.on('chainChanged', (changedChainId: number) => {
      if (String(changedChainId) !== String(chainId)) {
        console.log(
          `Layer1 WC chainChanged to ${changedChainId}. Disconnecting`
        );
        strategy.disconnect();
      }
    });

    // Subscribe to session disconnection
    // This is how WalletConnect informs us if we disconnect the Dapp
    // from the wallet side. Unlike MetaMask, listening to 'accountsChanged'
    // does not work.
    provider.on('disconnect', (code: number, reason: string) => {
      console.log('disconnect', code, reason);
      // without checking this, the event will fire twice.
      this.onDisconnect();
    });

    return provider;
  }

  async approve(
    amountInWei: BN,
    tokenSymbol: string
  ): Promise<TransactionReceipt> {
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    let token = this.getTokenBySymbol(tokenSymbol);
    return tokenBridge.unlockTokens(token.address, amountInWei.toString());
  }

  async relayTokens(
    tokenSymbol: string,
    receiverAddress: string,
    amountInWei: BN
  ): Promise<TransactionReceipt> {
    let tokenBridge = await getSDK('TokenBridgeForeignSide', this.web3);
    let token = this.getTokenBySymbol(tokenSymbol);
    return tokenBridge.relayTokens(
      token.address,
      receiverAddress,
      amountInWei.toString()
    );
  }

  private getTokenBySymbol(symbol: string): TokenContractInfo {
    let token = this.bridgeableTokens.findBy('symbol', symbol);
    if (!token) {
      throw new Error(`Expected to find bridgeable token for symbol ${symbol}`);
    }
    return token!;
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'blockExplorer',
      this.networkSymbol
    )}/tx/${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork(
      'bridgeExplorer',
      this.networkSymbol
    )}/${txnHash}`;
  }
}
