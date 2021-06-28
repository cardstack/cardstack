import Layer1ChainWeb3Strategy from './layer1-chain';
import { networkDisplayInfo } from './network-display-info';

export default class EthereumWeb3Strategy extends Layer1ChainWeb3Strategy {
  constructor() {
    super('mainnet', networkDisplayInfo.mainnet.fullName);
  }
}
