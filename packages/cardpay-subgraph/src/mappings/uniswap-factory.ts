import { PairCreated } from '../../generated/UniswapFactory/UniswapV2Factory';
import { UniswapV2Pair as TokenPairTemplate } from '../../generated/templates';
import { makeToken, toChecksumAddress } from '../utils';
import { TokenPair } from '../../generated/schema';
import { allowedTokens as xdaiAllowedTokens } from '../allowed-tokens/xdai';
import { allowedTokens as sokolAllowedTokens } from '../allowed-tokens/sokol';

export function handleNewPair(event: PairCreated): void {
  if (
    xdaiAllowedTokens.has(toChecksumAddress(event.params.token0)) ||
    xdaiAllowedTokens.has(toChecksumAddress(event.params.token1)) ||
    sokolAllowedTokens.has(toChecksumAddress(event.params.token0)) ||
    sokolAllowedTokens.has(toChecksumAddress(event.params.token1))
  ) {
    let pair = toChecksumAddress(event.params.pair);

    let token0 = makeToken(event.params.token0);
    let token1 = makeToken(event.params.token1);
    let pairEntity = new TokenPair(pair);
    pairEntity.token0 = token0;
    pairEntity.token1 = token1;
    pairEntity.save();

    TokenPairTemplate.create(event.params.pair);
  }
}
