import { Web3Strategy } from './types';

export default class EthereumWeb3Strategy implements Web3Strategy {
  isConnected: boolean = false;
  walletConnectUri: string | undefined;
}
