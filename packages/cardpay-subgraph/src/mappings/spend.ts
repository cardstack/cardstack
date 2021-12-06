import { Mint as MintEvent, Spend } from '../../generated/Spend/Spend';
import { SpendAccumulation, MerchantSafe } from '../../generated/schema';
import { makeTransaction, toChecksumAddress } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleMint(event: MintEvent): void {
  makeTransaction(event);

  let merchantSafe = toChecksumAddress(event.params.account);
  let txnHash = event.transaction.hash.toHex();
  let merchantSafeEntity = MerchantSafe.load(merchantSafe);
  let spend = Spend.bind(event.address);
  let spendBalance = spend.balanceOf(event.params.account);
  if (merchantSafeEntity != null) {
    merchantSafeEntity.spendBalance = spendBalance;
    merchantSafeEntity.save();
  } else {
    log.warning(
      'Cannot process spend minting txn {}: MerchantSafe entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the merchant safe was created in.',
      [txnHash, merchantSafe]
    );
    return;
  }

  let entity = new SpendAccumulation(event.transaction.hash.toHex()); // There will only ever be one spend minting event per txn
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.merchantSafe = merchantSafe;
  entity.amount = event.params.amount;
  entity.historicSpendBalance = spendBalance;
  entity.save();
}
