import { Mint as MintEvent } from '../../generated/Spend/Spend';
import { SpendAccumulation, MerchantSafe } from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';

export function handleMint(event: MintEvent): void {
  assertTransactionExists(event);

  let merchantSafe = toChecksumAddress(event.params.account);
  let txnHash = event.transaction.hash.toHex();
  let merchantSafeEntity = MerchantSafe.load(merchantSafe);
  if (merchantSafeEntity != null) {
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    merchantSafeEntity.spendBalance = merchantSafeEntity.spendBalance + event.params.amount;
    merchantSafeEntity.save();
  } else {
    assert(
      false,
      'Error while processing spend minting txn ' +
        txnHash +
        ', MerchantSafe entity does not exist for address ' +
        merchantSafe
    );
    return;
  }

  let entity = new SpendAccumulation(event.transaction.hash.toHex()); // There will only ever be one spend minting event per txn
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.merchantSafe = merchantSafe;
  entity.amount = event.params.amount;
  entity.historicSpendBalance = merchantSafeEntity.spendBalance;
  entity.save();
}
