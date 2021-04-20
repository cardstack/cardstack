import { tracked } from '@glimmer/tracking';
import { WalletProvider } from '../wallet-providers';
import { Layer1Web3Strategy } from './types';
import detectEthereumProvider from '@metamask/detect-provider';
import WalletInfo from '../wallet-info';
import { defer } from 'rsvp';
import Web3 from 'web3';
import { BigNumber } from '@ethersproject/bignumber';

const DAI_TOKEN_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa';
const ERC20_MIN_ABI = [
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
  @tracked walletInfo = { accounts: [], chainId: -1 } as WalletInfo;
  waitForAccountDeferred = defer();

  @tracked defaultTokenBalance: BigNumber | undefined;
  @tracked daiBalance: number | undefined;
  @tracked cardBalance: number | undefined;
  waitForAccount: Promise<void>;

  async connect(walletProvider: WalletProvider): Promise<void> {
    if (walletProvider.id === 'metamask') {
      this.provider = await detectEthereumProvider();
      if (this.provider) {
        if (this.provider !== window.ethereum) {
          console.error('Do you have multiple wallets installed?');
          return;
        }
      } else {
        console.log('Please install MetaMask!');
      }
    }
    this.provider.on('accountsChanged', (accounts: string[]) => {
      this.updateWalletInfo(accounts, this.chainId);
    });

    // Subscribe to chainId change
    this.provider.on('chainChanged', (chainId: number) => {
      console.log(chainId);
    });

    // Subscribe to provider connection
    this.provider.on('connect', (info: { chainId: number }) => {
      console.log(info);
    });

    // Subscribe to provider disconnection
    this.provider.on(
      'disconnect',
      (error: { code: number; message: string }) => {
        console.log(error);
      }
    );
    let accounts = await this.provider.request({
      method: 'eth_requestAccounts',
    });
    this.updateWalletInfo(accounts, this.chainId);
  }

  get isConnected(): boolean {
    return this.walletInfo.accounts.length > 0;
  }

  updateWalletInfo(accounts: string[], chainId: number) {
    this.walletInfo = new WalletInfo(accounts, chainId);
    if (accounts.length > 0) {
      this.refreshBalances();
      this.waitForAccountDeferred.resolve();
    } else {
      this.waitForAccountDeferred = defer();
    }
  }

  clearWalletInfo() {
    this.updateWalletInfo([], -1);
  }

  async refreshBalances() {
    let defaultTokenBalance = await this.provider.request({
      method: 'eth_getBalance',
      params: [this.walletInfo.firstAddress, 'latest'],
    });
    this.defaultTokenBalance = BigNumber.from(defaultTokenBalance);

    let web3 = new Web3();
    web3.setProvider(this.provider);
    let daiTokenContract = new web3.eth.Contract(
      ERC20_MIN_ABI,
      DAI_TOKEN_ADDRESS
    );
    let daiBalance = await daiTokenContract.methods
      .balanceOf(this.walletInfo.firstAddress)
      .call();
    this.daiBalance = daiBalance;
  }
  unlock(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deposit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
