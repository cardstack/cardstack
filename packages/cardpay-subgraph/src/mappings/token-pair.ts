import { Swap as SwapEvent } from '../../generated/templates/UniswapV2Pair/UniswapV2Pair';
import { makeEOATransaction, makeEOATransactionForSafe, toChecksumAddress } from '../utils';
import { Safe, TokenSwap } from '../../generated/schema';

export function handleSwap(event: SwapEvent): void {
  let to = toChecksumAddress(event.params.to);
  let toSafe = Safe.load(to);
  if (toSafe != null) {
    makeEOATransactionForSafe(event, toSafe.id);
  } else {
    makeEOATransaction(event, to);
  }

  let txnHash = event.transaction.hash.toHex();
  let pair = toChecksumAddress(event.address);
  let swapEntity = new TokenSwap(txnHash);
  swapEntity.transaction = txnHash;
  swapEntity.timestamp = event.block.timestamp;
  swapEntity.blockNumber = event.block.number;
  swapEntity.tokenPair = pair;
  swapEntity.to = to;
  swapEntity.token0AmountIn = event.params.amount0In;
  swapEntity.token0AmountOut = event.params.amount0Out;
  swapEntity.token1AmountIn = event.params.amount1In;
  swapEntity.token1AmountOut = event.params.amount1Out;
  swapEntity.save();
}
