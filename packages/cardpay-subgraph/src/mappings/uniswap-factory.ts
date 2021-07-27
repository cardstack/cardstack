import { PairCreated } from '../../generated/UniswapFactory/UniswapV2Factory';
import { UniswapV2Pair as TokenPairTemplate } from '../../generated/templates';
import { makeToken, toChecksumAddress } from '../utils';
import { TokenPair } from '../../generated/schema';

export function handleNewPair(event: PairCreated): void {
  let pair = toChecksumAddress(event.params.pair);

  let token0 = makeToken(event.params.token0);
  let token1 = makeToken(event.params.token1);
  let pairEntity = new TokenPair(pair);
  pairEntity.token0 = token0;
  pairEntity.token1 = token1;
  pairEntity.save();

  TokenPairTemplate.create(event.params.pair);
}
