export interface Web3Strategy {
  chainName: string;
  isConnected: boolean;
  walletConnectUri: string | undefined;
}

export interface Layer1Web3Strategy extends Web3Strategy {
  defaultTokenBalance: number | undefined;
  daiBalance: number | undefined;
  cardBalance: number | undefined;
  unlock(): Promise<void>;
  deposit(): Promise<void>;
}

export interface Layer2Web3Strategy extends Web3Strategy {
  xdaiBalance: number | undefined;
}
