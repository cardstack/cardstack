import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import { Layer2NetworkSymbol } from './web3-strategies/types';

export function getLayer2RpcWssNodeUrl(networkSymbol: Layer2NetworkSymbol) {
  if (window.localStorage.getItem('layer2RpcWssNode') === 'next') {
    return getConstantByNetwork('rpcWssNodeNext', networkSymbol);
  } else {
    return getConstantByNetwork('rpcWssNode', networkSymbol);
  }
}
