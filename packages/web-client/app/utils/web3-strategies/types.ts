import { WalletProvider } from '../wallet-providers';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';
import {
  ConvertibleSymbol,
  ConversionFunction,
} from '@cardstack/web-client/utils/token';
import { Emitter } from '@cardstack/web-client/utils/events';

export interface Web3Strategy extends Emitter {
  chainName: string;
  isConnected: boolean;
  walletConnectUri: string | undefined;
  disconnect(): Promise<void>;
}

export interface Layer1Web3Strategy extends Web3Strategy {
  isConnected: boolean;
  currentProviderId: string | undefined;
  defaultTokenBalance: BN | undefined;
  daiBalance: BN | undefined;
  cardBalance: BN | undefined;
  refreshBalances(): void;
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
  isConnected: boolean;
  defaultTokenBalance: BN | undefined;
  cardBalance: BN | undefined;
  depotSafe: DepotSafe | null;
  updateUsdConverters(
    symbolsToUpdate: ConvertibleSymbol[]
  ): Promise<Record<ConvertibleSymbol, ConversionFunction>>;
  blockExplorerUrl(txnHash: TransactionHash): string;
  getBlockHeight(): Promise<BN>;
  awaitBridged(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt>;
  fetchDepotTask(): Promise<DepotSafe | null>;
  refreshBalances(): void;
}

export type TransactionHash = string;
export type ChainAddress = string;

export interface ColorCustomizationOption {
  headerBackground: string;
  textColor: string;
  patternColor: string;
  id: string;
  description?: string;
}

export interface PatternCustomizationOption {
  patternUrl: string | null;
  id: string;
  description?: string;
}
