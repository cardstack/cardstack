import { Swap as SwapEvent } from '../../generated/templates/TokenPair/UniswapV2Pair';
import { makeTransaction, toChecksumAddress } from '../utils';
import { Account, TokenSwap } from '../../generated/schema';

export function handleSwap(event: SwapEvent): void {
  makeTransaction(event);

  let sender = new Account(toChecksumAddress(event.params.sender));
  sender.save();
  let to = new Account(toChecksumAddress(event.params.to));
  to.save();

  let txnHash = event.transaction.hash.toHex();
  let pair = toChecksumAddress(event.address);
  let swapEntity = new TokenSwap(txnHash);
  swapEntity.transaction = txnHash;
  swapEntity.timestamp = event.block.timestamp;
  swapEntity.tokenPair = pair;
  swapEntity.sender = sender.id;
  swapEntity.to = to.id;
  swapEntity.token0AmountIn = event.params.amount0In;
  swapEntity.token0AmountOut = event.params.amount0Out;
  swapEntity.token1AmountIn = event.params.amount1In;
  swapEntity.token1AmountOut = event.params.amount1Out;
  swapEntity.save();
}
