/* eslint-disable no-unused-vars */
import { WalletProvider } from '../wallet-providers';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';
import { AbiItem } from 'web3-utils';
import { ERC20ABI } from '@cardstack/cardpay-sdk/index.js';
import { SafeInfo } from '@cardstack/cardpay-sdk/sdk/safes';

export interface Web3Strategy {
  chainName: string;
  isConnected: boolean;
  walletConnectUri: string | undefined;
  disconnect(): Promise<void>;
}

export interface Layer1Web3Strategy extends Web3Strategy {
  defaultTokenBalance: BN | undefined;
  currentProviderId: string | undefined;
  daiBalance: BN | undefined;
  cardBalance: BN | undefined;
  connect(walletProvider: WalletProvider): Promise<void>;
  waitForAccount: Promise<void>;
  approve(amountInWei: BN, token: string): Promise<TransactionReceipt>;
  relayTokens(
    token: ChainAddress,
    destinationAddress: ChainAddress,
    amountInWei: BN
  ): Promise<TransactionReceipt>;
  blockExplorerUrl(txnHash: TransactionHash): string;
  bridgeExplorerUrl(txnHash: TransactionHash): string;
}

export interface Layer2Web3Strategy extends Web3Strategy {
  defaultTokenBalance: BN | undefined;
  updateUsdConverters(): void;
  blockExplorerUrl(txnHash: TransactionHash): string;
  getBlockHeight(): Promise<BN>;
  awaitBridged(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt>;
  fetchDepot(owner: ChainAddress): Promise<SafeInfo | null>;
}

export type TransactionHash = string;
export type ChainAddress = string;

export class Token {
  symbol: string;
  name: string;
  address: ChainAddress;
  abi = ERC20ABI as AbiItem[];

  constructor(symbol: string, name: string, address: string) {
    this.symbol = symbol;
    this.name = name;
    this.address = address;
  }
}
