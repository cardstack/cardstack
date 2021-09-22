import { BigInt } from '@graphprotocol/graph-ts';
import { MerchantCreation as MerchantCreationEvent } from '../../../generated/DeprecatedMerchant/DeprecatedMerchantManager_v0_6_7';
import { Account, MerchantSafe, MerchantCreation } from '../../../generated/schema';
import { makeEOATransaction, toChecksumAddress } from '../../utils';

export function handleMerchantCreation(event: MerchantCreationEvent): void {
  let merchant = toChecksumAddress(event.params.merchant);
  makeEOATransaction(event, merchant, null);

  let merchantSafe = toChecksumAddress(event.params.merchantSafe);
  let infoDID = event.params.infoDID;

  let accountEntity = new Account(merchant);
  accountEntity.save();

  let merchantSafeEntity = new MerchantSafe(merchantSafe);
  merchantSafeEntity.safe = merchantSafe;
  merchantSafeEntity.merchant = merchant;
  merchantSafeEntity.infoDid = infoDID;
  merchantSafeEntity.spendBalance = new BigInt(0);
  merchantSafeEntity.save();

  let creationEntity = new MerchantCreation(merchantSafe);
  creationEntity.transaction = event.transaction.hash.toHex();
  creationEntity.createdAt = event.block.timestamp;
  creationEntity.merchantSafe = merchantSafe;
  creationEntity.merchant = merchant;
  creationEntity.save();
}
