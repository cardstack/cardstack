export interface Web3Strategy {
  chainName: string;
  isConnected: boolean;
  walletConnectUri: string | undefined;
  unlock(): Promise<void>;
  deposit(): Promise<void>;
}
