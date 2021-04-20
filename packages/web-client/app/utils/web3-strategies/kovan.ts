import WalletConnectProvider from '@walletconnect/web3-provider';
import { tracked } from '@glimmer/tracking';
import { WalletProvider } from '../wallet-providers';
import { Layer1Web3Strategy } from './types';
import detectEthereumProvider from '@metamask/detect-provider';
import WalletInfo from '../wallet-info';
import { defer } from 'rsvp';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { BigNumber } from '@ethersproject/bignumber';

const WALLET_CONNECT_BRIDGE = 'https://safe-walletconnect.gnosis.io/';
const INFURA_ID = '';

const CARD_TOKEN_ADDRESS = '0xd6E34821F508e4247Db359CFceE0cb5e8050972a';
const DAI_TOKEN_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa';
const ERC20_MIN_ABI: AbiItem[] = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  // decimals
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
];
export default class KovanWeb3Strategy implements Layer1Web3Strategy {
  chainName = 'Kovan Testnet';
  chainId = 42;
  walletConnectUri: string | undefined;
  provider: any | undefined;
  web3 = new Web3();
  cardTokenContract = new this.web3.eth.Contract(
    ERC20_MIN_ABI,
    CARD_TOKEN_ADDRESS
  );
  daiTokenContract = new this.web3.eth.Contract(
    ERC20_MIN_ABI,
    DAI_TOKEN_ADDRESS
  );

  @tracked walletInfo = new WalletInfo([], this.chainId);

  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: BigNumber | undefined;
  @tracked cardBalance: BigNumber | undefined;
  #waitForAccountDeferred = defer<void>();
  get waitForAccount(): Promise<void> {
    return this.#waitForAccountDeferred.promise;
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
    } else if (walletProvider.id === 'wallet-connect') {
      this.provider = this.setupWalletConnect();
      this.web3.setProvider(this.provider);
      await this.provider.enable();
      let accounts = await this.web3.eth.getAccounts();
      this.updateWalletInfo(accounts, this.chainId);
    }
  }

  setupWalletConnect(): any {
    let provider = new WalletConnectProvider({
      bridge: WALLET_CONNECT_BRIDGE,
      chainId: 42,
      infuraId: INFURA_ID,
      qrcode: true,
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
  getDefaultTokenBalance() {
    return this.provider.request({
      method: 'eth_getBalance',
      params: [this.walletInfo.firstAddress, 'latest'],
    });
  }
  getErc20Balance(contract: Contract) {
    return contract.methods.balanceOf(this.walletInfo.firstAddress).call();
  }

  unlock(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deposit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
