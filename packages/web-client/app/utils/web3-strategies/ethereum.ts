import Layer1ChainWeb3Strategy from './layer1-chain';
export default class EthereumWeb3Strategy extends Layer1ChainWeb3Strategy {
  constructor() {
    super('mainnet');
  }
}
