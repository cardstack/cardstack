import { WalletProvider } from '../wallet-providers';
import { BigNumber } from '@ethersproject/bignumber';

export interface Web3Strategy {
  chainName: string;
  isConnected: boolean;
  walletConnectUri: string | undefined;
}

export interface Layer1Web3Strategy extends Web3Strategy {
  defaultTokenBalance: BigNumber | undefined;
  daiBalance: BigNumber | undefined;
  cardBalance: BigNumber | undefined;
  connect(walletProvider: WalletProvider): Promise<void>; // eslint-disable-line no-unused-vars
  disconnect(): Promise<void>;
  waitForAccount: Promise<void>;
  unlock(): Promise<void>;
  deposit(): Promise<void>;
}

export interface Layer2Web3Strategy extends Web3Strategy {
  defaultTokenBalance: BigNumber | undefined;
}
