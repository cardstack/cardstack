import config from '../../config/environment';
import CustomStorageWalletConnect from '../wc-connector';
import WalletConnectProvider from '@walletconnect/web3-provider';
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal';
import { tracked } from '@glimmer/tracking';
import { WalletProvider } from '../wallet-providers';
import { Layer1Web3Strategy, TransactionHash } from './types';
import { TokenContractInfo } from '../token';
import detectEthereumProvider from '@metamask/detect-provider';
import WalletInfo from '../wallet-info';
import { defer } from 'rsvp';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';
import {
  TokenBridgeForeignSide,
  networkIds,
  getConstantByNetwork,
} from '@cardstack/cardpay-sdk';
import {
  DappEvents,
  UnbindEventListener,
} from '@cardstack/web-client/utils/events';
import { registerDestructor } from '@ember/destroyable';

const WALLET_CONNECT_BRIDGE = 'https://safe-walletconnect.gnosis.io/';

let cardToken = new TokenContractInfo('CARD', 'kovan');

let daiToken = new TokenContractInfo('DAI', 'kovan');

// emits event
export default class KovanWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Kovan testnet';
  chainId = networkIds['kovan'];
  bridgeableTokens = [daiToken, cardToken];
  walletConnectUri: string | undefined;
  provider: any | undefined;
  web3 = new Web3();
  cardTokenContract = new this.web3.eth.Contract(
    cardToken.abi,
    cardToken.address
  );
  daiTokenContract = new this.web3.eth.Contract(daiToken.abi, daiToken.address);

  dappEvents = new DappEvents();

  @tracked currentProviderId: string | undefined;
  @tracked walletInfo = new WalletInfo([], this.chainId);

  @tracked defaultTokenBalance: BN | undefined;
  @tracked daiBalance: BN | undefined;
  @tracked cardBalance: BN | undefined;
  #waitForAccountDeferred = defer<void>();
  broadcastChannel: BroadcastChannel;

  constructor() {
    this.initialize();
    // the broadcast channel is really for metamask disconnections
    // since metamask doesn't allow you to disconnect from the dapp side
    // we want to ensure that users don't get confused by different tabs having
    // different wallets connected
    this.broadcastChannel = new BroadcastChannel(this.chainName);
    this.broadcastChannel.onmessage = (event: MessageEvent) => {
      if (event.data === 'disconnected') this.onDisconnect();
    };
    registerDestructor(this, this.broadcastChannel.close);
  }

  get providerStorageKey(): string {
    return `cardstack-chain-${this.chainId}-provider`;
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

  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  on(event: string, cb: Function): UnbindEventListener {
    return this.dappEvents.on(event, cb);
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

  onDisconnect() {
    if (this.isConnected) {
      this.clearLocalConnectionState();
      this.dappEvents.emit('disconnect');
      this.broadcastChannel.postMessage('disconnected');
    }
  }

  clearLocalConnectionState() {
    this.clearWalletInfo();
    this.provider = undefined;
    this.web3.setProvider(this.provider);
    this.currentProviderId = '';
    window.localStorage.removeItem(this.providerStorageKey);
  }

  setupWalletConnect(): any {
    let provider = new WalletConnectProvider({
      chainId: networkIds['kovan'],
      infuraId: config.infuraId,
      // based on https://github.com/WalletConnect/walletconnect-monorepo/blob/7aa9a7213e15489fa939e2e020c7102c63efd9c4/packages/providers/web3-provider/src/index.ts#L47-L52
      connector: new CustomStorageWalletConnect(
        {
          bridge: WALLET_CONNECT_BRIDGE,
          qrcodeModal: WalletConnectQRCodeModal,
        },
        this.chainId
      ),
    });

    // Subscribe to accounts change
    provider.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length) this.updateWalletInfo(accounts, this.chainId);
    });

    // Subscribe to chainId change
    let strategy = this;
    provider.on('chainChanged', (chainId: number) => {
      if (String(chainId) !== String(networkIds['kovan'])) {
        console.log(`Layer1 WC chainChanged to ${chainId}. Disconnecting`);
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

  async setupMetamask() {
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

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }

  updateWalletInfo(accounts: string[], chainId: number) {
    this.walletInfo = new WalletInfo(accounts, chainId);
    if (accounts.length > 0) {
      this.refreshBalances();
      this.#waitForAccountDeferred.resolve();
    } else {
      this.#waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }

  async refreshBalances() {
    let balances = await Promise.all<string>([
      this.getDefaultTokenBalance(),
      this.getErc20Balance(this.daiTokenContract),
      this.getErc20Balance(this.cardTokenContract),
    ]);
    let [defaultTokenBalance, daiBalance, cardBalance] = balances;
    this.defaultTokenBalance = toBN(defaultTokenBalance);
    this.daiBalance = toBN(daiBalance);
    this.cardBalance = toBN(cardBalance);
  }
  async getDefaultTokenBalance() {
    if (this.walletInfo.firstAddress)
      return await this.web3.eth.getBalance(
        this.walletInfo.firstAddress,
        'latest'
      );
    else return 0;
  }
  getErc20Balance(contract: Contract) {
    return contract.methods.balanceOf(this.walletInfo.firstAddress).call();
  }

  approve(amountInWei: BN, tokenSymbol: string): Promise<TransactionReceipt> {
    let tokenBridge = new TokenBridgeForeignSide(this.web3);
    let token = this.getTokenBySymbol(tokenSymbol);
    return tokenBridge.unlockTokens(token.address, amountInWei.toString());
  }

  relayTokens(
    tokenSymbol: string,
    receiverAddress: string,
    amountInWei: BN
  ): Promise<TransactionReceipt> {
    let tokenBridge = new TokenBridgeForeignSide(this.web3);
    let token = this.getTokenBySymbol(tokenSymbol);
    return tokenBridge.relayTokens(
      token.address,
      receiverAddress,
      amountInWei.toString()
    );
  }

  getTokenBySymbol(symbol: string): TokenContractInfo {
    let token = this.bridgeableTokens.findBy('symbol', symbol);
    if (!token) {
      throw new Error(`Expected to find bridgeable token for symbol ${symbol}`);
    }
    return token!;
  }

  blockExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork('blockExplorer', 'kovan')}/tx/${txnHash}`;
  }

  bridgeExplorerUrl(txnHash: TransactionHash): string {
    return `${getConstantByNetwork('bridgeExplorer', 'kovan')}/${txnHash}`;
  }
}
