import { MerchantCreation as MerchantCreationEvent } from '../../generated/RevenuePool/RevenuePool';
import { Account, MerchantSafe, MerchantCreation } from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';

export function handleMerchantCreation(event: MerchantCreationEvent): void {
  assertTransactionExists(event);

  let merchant = toChecksumAddress(event.params.merchant);
  let merchantSafe = toChecksumAddress(event.params.merchantSafe);
  let infoDID = event.params.infoDID;

  let accountEntity = new Account(merchant);
  accountEntity.save();

  let merchantSafeEntity = new MerchantSafe(merchantSafe);
  merchantSafeEntity.safe = merchantSafe;
  merchantSafeEntity.merchant = merchant;
  merchantSafeEntity.infoDid = infoDID;
  merchantSafeEntity.save();

  let creationEntity = new MerchantCreation(merchantSafe);
  creationEntity.transaction = event.transaction.hash.toHex();
  creationEntity.createdAt = event.block.timestamp;
  creationEntity.merchantSafe = merchantSafe;
  creationEntity.merchant = merchant;
  creationEntity.save();
}
