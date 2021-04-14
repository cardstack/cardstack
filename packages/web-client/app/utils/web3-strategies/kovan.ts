import { Web3Strategy } from './types';

export default class EthereumWeb3Strategy implements Web3Strategy {
  chainName = 'Kovan Testnet';
  chainId = 42;
  isConnected: boolean = false;
  walletConnectUri: string | undefined;
  unlock(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deposit(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
