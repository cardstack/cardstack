export interface Web3Strategy {
  isConnected: boolean;
  walletConnectUri: string | undefined;
  unlock(): Promise<void>;
  deposit(): Promise<void>;
}
