import { BigInt } from '@graphprotocol/graph-ts';
import {
  MerchantCreation as MerchantCreationEvent,
  CustomerPayment as MerchantPaymentEvent,
  MerchantFeeCollected as MerchantFeeEvent,
} from '../../generated/RevenuePool/RevenuePool';
import {
  Account,
  MerchantSafe,
  MerchantCreation,
  MerchantFeePayment,
  MerchantPayment,
  PrepaidCard,
} from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';

export function handleMerchantPayment(event: MerchantPaymentEvent): void {
  assertTransactionExists(event);

  let prepaidCard = toChecksumAddress(event.params.card);
  let prepaidCardEntity = PrepaidCard.load(prepaidCard);
  let txnHash = event.transaction.hash.toHex();
  if (prepaidCardEntity != null) {
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    prepaidCardEntity.spendBalance = prepaidCardEntity.spendBalance - event.params.spendAmount;
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    prepaidCardEntity.issuingTokenBalance = prepaidCardEntity.issuingTokenBalance - event.params.issuingTokenAmount;
    prepaidCardEntity.save();
  } else {
    assert(
      false,
      'Error while processing merchant payment txn ' +
        txnHash +
        ', PrepaidCard entity does not exist for prepaid card ' +
        prepaidCard
    );
    return;
  }
  let entity = new MerchantPayment(event.transaction.hash.toHex()); // There will only ever be one merchant payment event per txn
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.prepaidCard = prepaidCard;
  entity.merchantSafe = toChecksumAddress(event.params.merchantSafe);
  entity.issuingToken = toChecksumAddress(event.params.issuingToken);
  entity.issuingTokenAmount = event.params.issuingTokenAmount;
  entity.spendAmount = event.params.spendAmount;
  entity.historicIssuingTokenBalance = prepaidCardEntity.issuingTokenBalance;
  entity.historicSpendBalance = prepaidCardEntity.spendBalance;
  entity.save();
}

export function handleMerchantFee(event: MerchantFeeEvent): void {
  assertTransactionExists(event);

  let entity = new MerchantFeePayment(event.transaction.hash.toHex()); // There will only ever be one merchant fee collection event per txn
  entity.transaction = event.transaction.hash.toHex();
  entity.timestamp = event.block.timestamp;
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
  merchantSafeEntity.spendBalance = new BigInt(0);
  merchantSafeEntity.save();

  let creationEntity = new MerchantCreation(merchantSafe);
  creationEntity.transaction = event.transaction.hash.toHex();
  creationEntity.createdAt = event.block.timestamp;
  creationEntity.merchantSafe = merchantSafe;
  creationEntity.merchant = merchant;
  creationEntity.save();
}
