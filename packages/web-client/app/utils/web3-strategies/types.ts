import { WalletProvider } from '../wallet-providers';
import { BigNumber } from '@ethersproject/bignumber';
import { TransactionReceipt } from 'web3-core';
import { AbiItem } from 'web3-utils';
import { ERC20ABI } from '@cardstack/cardpay-sdk/index.js';

export interface Web3Strategy {
  chainName: string;
  isConnected: boolean;
  walletConnectUri: string | undefined;
  disconnect(): Promise<void>;
}

export interface Layer1Web3Strategy extends Web3Strategy {
  defaultTokenBalance: BigNumber | undefined;
  currentProviderId: string | undefined;
  daiBalance: BigNumber | undefined;
  cardBalance: BigNumber | undefined;
  connect(walletProvider: WalletProvider): Promise<void>; // eslint-disable-line no-unused-vars
  waitForAccount: Promise<void>;
  approve(amountInWei: BigNumber, token: string): Promise<TransactionReceipt>; // eslint-disable-line no-unused-vars
  relayTokens(
    token: string, // eslint-disable-line no-unused-vars
    destinationAddress: string, // eslint-disable-line no-unused-vars
    amountInWei: BigNumber // eslint-disable-line no-unused-vars
  ): Promise<TransactionReceipt>;
  blockExplorerUrl(txnHash: TransactionHash): string; // eslint-disable-line no-unused-vars
  bridgeExplorerUrl(txnHash: TransactionHash): string; // eslint-disable-line no-unused-vars
}

export interface Layer2Web3Strategy extends Web3Strategy {
  defaultTokenBalance: BigNumber | undefined;
  blockExplorerUrl(txnHash: TransactionHash): string; // eslint-disable-line no-unused-vars
  getBlockHeight(): Promise<BigNumber>;
}

export type TransactionHash = string;

export class Token {
  symbol: string;
  name: string;
  address: string;
  abi = ERC20ABI as AbiItem[];

  constructor(symbol: string, name: string, address: string) {
    this.symbol = symbol;
    this.name = name;
    this.address = address;
  }
}
