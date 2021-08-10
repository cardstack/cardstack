import { WalletProvider } from '../wallet-providers';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';
import {
  DepotSafe,
  PrepaidCardSafe,
  Safe,
} from '@cardstack/cardpay-sdk/sdk/safes';
import {
  ConvertibleSymbol,
  ConversionFunction,
  BridgeableSymbol,
} from '@cardstack/web-client/utils/token';
import { Emitter } from '../events';
import { BridgeValidationResult } from '@cardstack/cardpay-sdk/sdk/token-bridge-home-side';
import { TaskGenerator } from 'ember-concurrency';

export type Layer1ChainEvent =
  | 'disconnect'
  | 'incorrect-chain'
  | 'correct-chain';
export type Layer2ChainEvent =
  | 'disconnect'
  | 'incorrect-chain'
  | 'correct-chain';

export interface Web3Strategy {
  isConnected: boolean;
  disconnect(): Promise<void>;
  bridgeExplorerUrl(txnHash: TransactionHash): string;
}

export interface ApproveOptions {
  onTxHash?(txHash: TransactionHash): void;
}

export interface RelayTokensOptions {
  onTxHash?(txHash: TransactionHash): void;
}

export interface IssuePrepaidCardOptions {
  onTxHash?(txHash: TransactionHash): void;
}

export interface ClaimBridgedTokensOptions {
  onTxHash?(txHash: TransactionHash): void;
}

export interface Layer1Web3Strategy
  extends Web3Strategy,
    Emitter<Layer1ChainEvent> {
  isInitializing: boolean;
  isConnected: boolean;
  currentProviderId: string | undefined;
  defaultTokenBalance: BN | undefined;
  daiBalance: BN | undefined;
  cardBalance: BN | undefined;
  bridgeConfirmationBlockCount: number;
  refreshBalances(): void;
  connect(walletProvider: WalletProvider): Promise<void>;
  waitForAccount: Promise<void>;
  approve(
    amountInWei: BN,
    token: string,
    options?: ApproveOptions
  ): Promise<TransactionReceipt>;
  relayTokens(
    token: ChainAddress,
    destinationAddress: ChainAddress,
    amountInWei: BN,
    options?: RelayTokensOptions
  ): Promise<TransactionReceipt>;
  blockExplorerUrl(txnHash: TransactionHash): string;
  claimBridgedTokens(
    bridgeValidationResult: BridgeValidationResult,
    options?: ClaimBridgedTokensOptions
  ): Promise<TransactionReceipt>;
  getBlockConfirmation(blockNumber: TxnBlockNumber): Promise<void>;
  getEstimatedGasForWithdrawalClaim(): Promise<BN>;
}

export interface Layer2Web3Strategy
  extends Web3Strategy,
    Emitter<Layer2ChainEvent> {
  isInitializing: boolean;
  isConnected: boolean;
  defaultTokenBalance: BN | undefined;
  cardBalance: BN | undefined;
  depotSafe: DepotSafe | null;
  walletConnectUri: string | undefined;
  initializeTask(): TaskGenerator<void>;
  updateUsdConverters(
    symbolsToUpdate: ConvertibleSymbol[]
  ): Promise<Record<ConvertibleSymbol, ConversionFunction>>;
  blockExplorerUrl(txnHash: TransactionHash): string;
  getBlockHeight(): Promise<BN>;
  awaitBridgedToLayer2(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt>;
  bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgeableSymbol,
    amountInWei: string
  ): Promise<TransactionHash>;
  awaitBridgedToLayer1(
    fromBlock: BN,
    txnHash: TransactionHash
  ): Promise<BridgeValidationResult>;
  viewSafe(address: string): Promise<Safe | undefined>;
  viewSafes(account: string): Promise<Safe[]>;
  checkHubAuthenticationValid(authToken: string): Promise<boolean>;
  authenticate(): Promise<string>;
  issuePrepaidCard(
    safeAddress: string,
    amount: number,
    customizationDid: string,
    options?: IssuePrepaidCardOptions
  ): Promise<PrepaidCardSafe>;
  fetchDepotTask(): Promise<DepotSafe | null>;
  refreshBalances(): void;
  convertFromSpend(symbol: ConvertibleSymbol, amount: number): Promise<any>;
}

export type TransactionHash = string;
export type TxnBlockNumber = number;
export type ChainAddress = string;

export type Layer1NetworkSymbol = 'kovan' | 'mainnet';
export type TestLayer1NetworkSymbol = 'test-layer1';
export type Layer2NetworkSymbol = 'xdai' | 'sokol';
export type TestLayer2NetworkSymbol = 'test-layer2';
export type NetworkSymbol = Layer1NetworkSymbol | Layer2NetworkSymbol;
