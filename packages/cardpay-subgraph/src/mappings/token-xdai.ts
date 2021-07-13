import { Transfer as TransferEvent } from '../../generated/Token/ERC20';
import { handleTransfer as baseHandleTransfer } from './token';
import { allowedTokens } from '../allowed-tokens/xdai';
import { toChecksumAddress } from '../utils';

export function handleTransfer(event: TransferEvent): void {
  if (allowedTokens.includes(toChecksumAddress(event.address))) {
    baseHandleTransfer(event);
  }
}
