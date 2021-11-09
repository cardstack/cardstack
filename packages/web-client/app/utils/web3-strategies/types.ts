import { WalletProvider } from '../wallet-providers';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';
import {
  DepotSafe,
  MerchantSafe,
  PrepaidCardSafe,
  Safe,
} from '@cardstack/cardpay-sdk/sdk/safes';
import {
  ConvertibleSymbol,
  ConversionFunction,
  BridgeableSymbol,
  BridgedTokenSymbol,
} from '@cardstack/web-client/utils/token';
import { Emitter } from '../events';
import { BridgeValidationResult } from '@cardstack/cardpay-sdk/sdk/token-bridge-home-side';
import { TaskGenerator } from 'ember-concurrency';
import { UsdConvertibleSymbol } from '@cardstack/web-client/services/token-to-usd';
import { TransactionOptions } from '@cardstack/cardpay-sdk';
import { ViewSafesResult } from '@cardstack/cardpay-sdk/sdk/safes/base';

export type Layer1ChainEvent =
  | 'disconnect'
  | 'incorrect-chain'
  | 'correct-chain'
  | 'account-changed'
  | 'websocket-disconnected';
export type Layer2ChainEvent =
  | 'disconnect'
  | 'incorrect-chain'
  | 'correct-chain'
  | 'account-changed'
  | 'websocket-disconnected';

export interface Web3Strategy {
  isConnected: boolean;
  disconnect(): Promise<void>;
  bridgeExplorerUrl(txnHash: TransactionHash): string;
}

export interface ApproveOptions {
  onTxnHash?(txnHash: TransactionHash): void;
}

export interface RelayTokensOptions {
  onTxnHash?(txnHash: TransactionHash): void;
}

export interface ClaimBridgedTokensOptions {
  onTxnHash?(txnHash: TransactionHash): void;
}

export interface WithdrawalLimits {
  min: BN;
  max: BN;
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
  nativeTokenSymbol: string | undefined;
  bridgeConfirmationBlockCount: number;
  refreshBalances(): Promise<void>;
  connect(walletProvider: WalletProvider): Promise<void>;
  waitForAccount: Promise<void>;
  approve(
    amountInWei: BN,
    token: string,
    options?: ApproveOptions
  ): Promise<TransactionReceipt>;
  resumeApprove(txnHash: string): Promise<TransactionReceipt>;
  relayTokens(
    token: ChainAddress,
    destinationAddress: ChainAddress,
    amountInWei: BN,
    options?: RelayTokensOptions
  ): Promise<TransactionReceipt>;
  resumeRelayTokens(txnHash: string): Promise<TransactionReceipt>;
  blockExplorerUrl(txnHash: TransactionHash): string;
  claimBridgedTokens(
    bridgeValidationResult: BridgeValidationResult,
    options?: ClaimBridgedTokensOptions
  ): Promise<TransactionReceipt>;
  resumeClaimBridgedTokens(txnHash: string): Promise<TransactionReceipt>;
  getBlockConfirmation(blockNumber: TxnBlockNumber): Promise<void>;
  getEstimatedGasForWithdrawalClaim(symbol: BridgeableSymbol): Promise<BN>;
  updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Record<UsdConvertibleSymbol, ConversionFunction>>;
}

export interface Layer2Web3Strategy
  extends Web3Strategy,
    Emitter<Layer2ChainEvent> {
  isInitializing: boolean;
  isConnected: boolean;
  defaultTokenBalance: BN | undefined;
  cardBalance: BN | undefined;
  depotSafe: DepotSafe | null;
  issuePrepaidCardSpendMinValue: number;
  /**
   * This property should only be accessed after layer 2 has been connected
   */
  issuePrepaidCardDaiMinValue: BN;
  walletConnectUri: string | undefined;
  initializeTask(): TaskGenerator<void>;
  updateUsdConverters(
    symbolsToUpdate: UsdConvertibleSymbol[]
  ): Promise<Record<UsdConvertibleSymbol, ConversionFunction>>;
  blockExplorerUrl(txnHash: TransactionHash): string;
  getBlockHeight(): Promise<BN>;
  awaitBridgedToLayer2(
    fromBlock: BN,
    receiver: ChainAddress
  ): Promise<TransactionReceipt>;
  getWithdrawalLimits(
    tokenSymbol: BridgedTokenSymbol
  ): Promise<WithdrawalLimits>;
  bridgeToLayer1(
    safeAddress: string,
    receiverAddress: string,
    tokenSymbol: BridgedTokenSymbol,
    amountInWei: string
  ): Promise<TransactionHash>;
  awaitBridgedToLayer1(
    fromBlock: BN,
    txnHash: TransactionHash
  ): Promise<BridgeValidationResult>;
  getLatestSafe(address: string): Promise<Safe>;
  viewSafesTask(account: string): TaskGenerator<ViewSafesResult>;
  checkHubAuthenticationValid(authToken: string): Promise<boolean>;
  authenticate(): Promise<string>;
  issuePrepaidCard(
    safeAddress: string,
    amount: number,
    customizationDid: string,
    options?: TransactionOptions
  ): Promise<PrepaidCardSafe>;
  resumeIssuePrepaidCardTransaction(txnHash: string): Promise<PrepaidCardSafe>;
  fetchMerchantRegistrationFee(): Promise<number>;
  registerMerchant(
    prepaidCardAddress: string,
    infoDid: string,
    options: TransactionOptions
  ): Promise<MerchantSafe>;
  resumeRegisterMerchantTransaction(txnHash: string): Promise<MerchantSafe>;
  defaultTokenSymbol: BridgedTokenSymbol;
  refreshSafesAndBalances(): void;
  convertFromSpend(symbol: ConvertibleSymbol, amount: number): Promise<string>;
}

export type TransactionHash = string;
export type TxnBlockNumber = number;
export type ChainAddress = string;

export type Layer1NetworkSymbol = 'kovan' | 'mainnet';
export type TestLayer1NetworkSymbol = 'test-layer1';
export type Layer2NetworkSymbol = 'xdai' | 'sokol';
export type TestLayer2NetworkSymbol = 'test-layer2';
export type NetworkSymbol = Layer1NetworkSymbol | Layer2NetworkSymbol;
