import Layer1ChainWeb3Strategy from './layer1-chain';
import { networkDisplayInfo } from './network-display-info';
export default class KovanWeb3Strategy extends Layer1ChainWeb3Strategy {
  constructor() {
    super('kovan', networkDisplayInfo.kovan.fullName);
  }
}
