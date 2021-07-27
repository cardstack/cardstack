import { PairCreated } from '../../generated/UniswapFactory/UniswapV2Factory';
import { toChecksumAddress } from '../utils';
import { handleNewPair as baseHandleNewPair } from './uniswap-factory';
import { allowedTokens } from '../allowed-tokens/xdai';

export function handleNewPair(event: PairCreated): void {
  if (
    allowedTokens.has(toChecksumAddress(event.params.token0)) ||
    allowedTokens.has(toChecksumAddress(event.params.token1))
  ) {
    baseHandleNewPair(event);
  }
}
