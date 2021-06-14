import {
  MerchantCreation as MerchantCreationEvent,
  CustomerPayment as MerchantPaymentEvent,
  MerchantFeeCollected as MerchantFeeEvent,
} from '../../generated/RevenuePool/RevenuePool';
import { Account, MerchantSafe, MerchantCreation, MerchantFeePayment, MerchantPayment } from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';

export function handleMerchantPayment(event: MerchantPaymentEvent): void {
  assertTransactionExists(event);

  let entity = new MerchantPayment(event.transaction.hash.toHex()); // There will only ever be one merchant payment event per txn
  entity.transaction = event.transaction.hash.toHex();
  entity.prepaidCard = toChecksumAddress(event.params.card);
  entity.merchantSafe = toChecksumAddress(event.params.merchantSafe);
  entity.issuingToken = toChecksumAddress(event.params.issuingToken);
  entity.issuingTokenAmount = event.params.issuingTokenAmount;
  entity.spendAmount = event.params.spendAmount;
  entity.save();
}

export function handleMerchantFee(event: MerchantFeeEvent): void {
  assertTransactionExists(event);

  let entity = new MerchantFeePayment(event.transaction.hash.toHex()); // There will only ever be one merchant fee collection event per txn
  entity.transaction = event.transaction.hash.toHex();
  entity.prepaidCard = toChecksumAddress(event.params.card);
  entity.merchantSafe = toChecksumAddress(event.params.merchantSafe);
  entity.issuingToken = toChecksumAddress(event.params.issuingToken);
  entity.feeCollected = event.params.amount;
  entity.save();
}

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
