import config from '../../config/environment';
import CustomStorageWalletConnect from '../wc-connector';
import WalletConnectProvider from '@walletconnect/web3-provider';
import WalletConnectQRCodeModal from '@walletconnect/qrcode-modal';
import { tracked } from '@glimmer/tracking';
import { WalletProvider } from '../wallet-providers';
import { Layer1Web3Strategy, TransactionHash, Token } from './types';
import detectEthereumProvider from '@metamask/detect-provider';
import WalletInfo from '../wallet-info';
import { defer } from 'rsvp';
import Web3 from 'web3';
import BRIDGE_ABI from '../../utils/contracts/bridge-contract-abi';
import { Contract } from 'web3-eth-contract';
import { BigNumber } from '@ethersproject/bignumber';
import { AbiItem } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';

const WALLET_CONNECT_BRIDGE = 'https://safe-walletconnect.gnosis.io/';
const HOME_BRIDGE_ADDRESS = '0x63AaCB22753d0DF234C32Ff62F5860da233cB360';
const FOREIGN_BRIDGE_ADDRESS = '0xAfbA2216Aae9Afe23FD09Cf5dfe420F6ecdDD04B';

let cardToken = new Token(
  'CARD',
  'CARD',
  '0xd6E34821F508e4247Db359CFceE0cb5e8050972a'
);

let daiToken = new Token(
  'DAI',
  'Dai Stablecoin',
  '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
);

export default class KovanWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Kovan Testnet';
  chainId = 42;
  bridgeableTokens = [daiToken, cardToken];
  walletConnectUri: string | undefined;
  currentProviderId: string | undefined;
  provider: any | undefined;
  web3 = new Web3();
  cardTokenContract = new this.web3.eth.Contract(
    cardToken.abi,
    cardToken.address
  );
  daiTokenContract = new this.web3.eth.Contract(daiToken.abi, daiToken.address);

  providerStorageKey = 'cardstack-layer-1-provider';
  @tracked walletInfo = new WalletInfo([], this.chainId);

  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: BigNumber | undefined;
  @tracked cardBalance: BigNumber | undefined;
  #waitForAccountDeferred = defer<void>();

  constructor() {
    this.initialize();
  }

  async initialize() {
    const previousProviderId = window.localStorage.getItem(
      this.providerStorageKey
    );
    if (previousProviderId === 'metamask') {
      this.connect({ id: 'metamask' } as WalletProvider);
    }
  }

  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
  }

  async connect(walletProvider: WalletProvider): Promise<void> {
    this.currentProviderId = walletProvider.id;
    if (this.currentProviderId === 'metamask') {
      this.provider = await this.setupMetamask();
      if (!this.provider) {
        return;
      }
      this.web3.setProvider(this.provider);
      let accounts = await this.provider.request({
        method: 'eth_requestAccounts',
      });
      this.updateWalletInfo(accounts, this.chainId);
      window.localStorage.setItem(this.providerStorageKey, 'metamask');
    } else if (this.currentProviderId === 'wallet-connect') {
      this.provider = this.setupWalletConnect();
      this.web3.setProvider(this.provider);
      await this.provider.enable();
      let accounts = await this.web3.eth.getAccounts();
      this.updateWalletInfo(accounts, this.chainId);
      window.localStorage.setItem(this.providerStorageKey, 'wallet-connect');
    }
  }

  async disconnect(): Promise<void> {
    // There is a solution in https://github.com/MetaMask/metamask-extension/issues/8990
    // that just makes the site think that the wallet isn't connected
    // It actually still is, you can see this when you open the wallet
    // The metamask team believes you should be disconnecting via the extension
    // and has not exposed any way to do this from a dapp
    if (this.currentProviderId === 'wallet-connect') {
      await this.provider.disconnect();
    }

    this.clearLocalConnectionState();
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
      chainId: 42,
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
    provider.on('chainChanged', (chainId: number) => {
      console.log('chainChanged', chainId);
    });

    // Subscribe to session disconnection
    provider.on('disconnect', (code: number, reason: string) => {
      console.log('disconnect', code, reason);
      this.clearLocalConnectionState();
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
      this.updateWalletInfo(accounts, this.chainId);
    });

    // Subscribe to chainId change
    provider.on('chainChanged', (chainId: number) => {
      console.log(chainId);
    });

    // Subscribe to provider connection
    provider.on('connect', (info: { chainId: number }) => {
      console.log(info);
    });

    // Subscribe to provider disconnection
    provider.on('disconnect', (error: { code: number; message: string }) => {
      console.log(error);
      this.clearLocalConnectionState();
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
    let balances = await Promise.all<String>([
      this.getDefaultTokenBalance(),
      this.getErc20Balance(this.daiTokenContract),
      this.getErc20Balance(this.cardTokenContract),
    ]);
    let [defaultTokenBalance, daiBalance, cardBalance] = balances.map((b) =>
      BigNumber.from(b)
    );
    this.defaultTokenBalance = BigNumber.from(defaultTokenBalance);
    this.daiBalance = BigNumber.from(daiBalance);
    this.cardBalance = BigNumber.from(cardBalance);
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

  approve(
    amountInWei: BigNumber,
    tokenSymbol: string
  ): Promise<TransactionReceipt> {
    let token = this.getTokenBySymbol(tokenSymbol);
    return this.contractForToken(token)
      .methods.approve(FOREIGN_BRIDGE_ADDRESS, amountInWei.toString())
      .send({ from: this.walletInfo.firstAddress });
  }

  relayTokens(
    amountInWei: BigNumber,
    tokenSymbol: string,
    destinationAddress: string
  ): Promise<TransactionReceipt> {
    let token = this.getTokenBySymbol(tokenSymbol);
    let bridgeTokenContract = new this.web3.eth.Contract(
      BRIDGE_ABI as AbiItem[],
      FOREIGN_BRIDGE_ADDRESS,
      {
        from: this.walletInfo.firstAddress,
        gasPrice: this.web3.utils.toWei('20', 'gwei'),
      }
    );
    let txnReceiptPromise = bridgeTokenContract.methods
      .relayTokens(token.address, destinationAddress, amountInWei.toString())
      .send({
        from: this.walletInfo.firstAddress,
        to: HOME_BRIDGE_ADDRESS,
        gas: 600000, // this is the gas limit
      });
    return txnReceiptPromise;
  }

  getTokenBySymbol(symbol: string): Token {
    let token = this.bridgeableTokens.findBy('symbol', symbol);
    if (!token) {
      throw new Error(`Expected to find bridgeable token for symbol ${symbol}`);
    }
    return token!;
  }

  contractForToken(token: Token): Contract {
    switch (token) {
      case daiToken:
        return this.daiTokenContract;
      case cardToken:
        return this.cardTokenContract;
      default:
        throw new Error(`Expected to find contract for token ${token}`);
    }
  }

  txnViewerUrl(txnHash: TransactionHash) {
    return `https://kovan.etherscan.io/tx/${txnHash}`;
  }
}
