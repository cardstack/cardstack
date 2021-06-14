import { Mint as MintEvent } from '../../generated/Spend/Spend';
import { SpendAccumulation } from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';

export function handleMint(event: MintEvent): void {
  assertTransactionExists(event);

  let entity = new SpendAccumulation(event.transaction.hash.toHex()); // There will only ever be one spend minting event per txn
  entity.transaction = event.transaction.hash.toHex();
  entity.merchantSafe = toChecksumAddress(event.params.account);
  entity.amount = event.params.amount;
  entity.save();
}
