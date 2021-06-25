import { Swap as SwapEvent } from '../../generated/templates/UniswapV2Pair/UniswapV2Pair';
import { makeEOATransaction, makeEOATransactionForSafe, toChecksumAddress } from '../utils';
import { Safe, TokenSwap } from '../../generated/schema';

export function handleSwap(event: SwapEvent): void {
  let sender = toChecksumAddress(event.params.sender);
  let to = toChecksumAddress(event.params.to);
  let senderSafe = Safe.load(sender);
  if (senderSafe != null) {
    makeEOATransactionForSafe(event, senderSafe as Safe);
  } else {
    makeEOATransaction(event, sender);
  }
  let toSafe = Safe.load(to);
  if (toSafe != null) {
    makeEOATransactionForSafe(event, toSafe as Safe);
  } else {
    makeEOATransaction(event, to);
  }

  let txnHash = event.transaction.hash.toHex();
  let pair = toChecksumAddress(event.address);
  let swapEntity = new TokenSwap(txnHash);
  swapEntity.transaction = txnHash;
  swapEntity.timestamp = event.block.timestamp;
  swapEntity.tokenPair = pair;
  swapEntity.sender = sender;
  swapEntity.to = to;
  swapEntity.token0AmountIn = event.params.amount0In;
  swapEntity.token0AmountOut = event.params.amount0Out;
  swapEntity.token1AmountIn = event.params.amount1In;
  swapEntity.token1AmountOut = event.params.amount1Out;
  swapEntity.save();
}
