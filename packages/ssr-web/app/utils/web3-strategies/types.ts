import { Emitter } from '@cardstack/ember-shared';
import { TaskGenerator } from 'ember-concurrency';

export type Layer2ChainEvent =
  | 'disconnect'
  | 'incorrect-chain'
  | 'correct-chain'
  | 'account-changed'
  | 'websocket-disconnected'
  | 'initialized';

export interface Web3Strategy {
  isConnected: boolean;
  disconnect(): Promise<void>;
}

export interface Layer2Web3Strategy
  extends Web3Strategy,
    Emitter<Layer2ChainEvent> {
  isInitializing: boolean;
  isConnected: boolean;
  walletConnectUri: string | undefined;
  initializeTask(): TaskGenerator<void>;
  checkHubAuthenticationValid(authToken: string): Promise<boolean>;
  authenticate(): Promise<string>;
}

export type TransactionHash = string;
export type TxnBlockNumber = number;
export type ChainAddress = string;

export type Layer2NetworkSymbol = 'gnosis' | 'sokol';
export type TestLayer2NetworkSymbol = 'test-layer2';
export type NetworkSymbol = Layer2NetworkSymbol;
