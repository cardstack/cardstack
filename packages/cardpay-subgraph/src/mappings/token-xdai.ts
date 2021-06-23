import { Transfer as TransferEvent } from '../../generated/Token/ERC20';
import { handleTransfer as baseHandleTransfer } from './token';

export function handleTransfer(event: TransferEvent): void {
  // for now we are indexing all the tokens we find, but if we start to run into
  // trouble with bad token contracts consider using the token list from
  // HoneySwap (located in ../allowedTokens/xdai)
  baseHandleTransfer(event);
}
