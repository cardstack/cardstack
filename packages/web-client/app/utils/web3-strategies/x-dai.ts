import Layer2ChainWeb3Strategy from './layer2-chain';
import { networkDisplayInfo } from './network-display-info';

export default class XDaiWeb3Strategy extends Layer2ChainWeb3Strategy {
  constructor() {
    super('xdai', networkDisplayInfo.xdai.fullName);
  }
}
