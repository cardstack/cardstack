import {
  CustomerPayment as MerchantPaymentEvent,
  MerchantFeeCollected as MerchantFeeEvent,
} from '../../generated/Payments/PayMerchantHandler';
import { MerchantFeePayment, MerchantRevenueEvent } from '../../generated/schema';
import { makeMerchantRevenue, makeTransaction, makePrepaidCardPayment, toChecksumAddress, makeToken } from '../utils';

export function handleMerchantPayment(event: MerchantPaymentEvent): void {
  makeTransaction(event);

  let prepaidCard = toChecksumAddress(event.params.card);
  let txnHash = event.transaction.hash.toHex();
  let merchantSafe = toChecksumAddress(event.params.merchantSafe);
  let issuingToken = makeToken(event.params.issuingToken);

  makePrepaidCardPayment(
    event,
    prepaidCard,
    txnHash,
    event.block.timestamp,
    merchantSafe,
    issuingToken,
    event.params.issuingTokenAmount,
    event.params.spendAmount
  );

  let revenueEntity = makeMerchantRevenue(merchantSafe, issuingToken);
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  revenueEntity.lifetimeAccumulation = revenueEntity.lifetimeAccumulation + event.params.issuingTokenAmount;
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  revenueEntity.unclaimedBalance = revenueEntity.unclaimedBalance + event.params.issuingTokenAmount;
  revenueEntity.save();

  let revenueEventEntity = new MerchantRevenueEvent(txnHash);
  revenueEventEntity.transaction = txnHash;
  revenueEventEntity.timestamp = event.block.timestamp;
  revenueEventEntity.merchantRevenue = merchantSafe + '-' + issuingToken;
  revenueEventEntity.historicLifetimeAccumulation = revenueEntity.lifetimeAccumulation;
  revenueEventEntity.historicUnclaimedBalance = revenueEntity.unclaimedBalance;
  revenueEventEntity.prepaidCardPayment = txnHash;
  revenueEventEntity.save();
}

export function handleMerchantFee(event: MerchantFeeEvent): void {
  makeTransaction(event);

  let entity = new MerchantFeePayment(event.transaction.hash.toHex()); // There will only ever be one merchant fee collection event per txn
  entity.transaction = event.transaction.hash.toHex();
  entity.timestamp = event.block.timestamp;
  entity.prepaidCard = toChecksumAddress(event.params.card);
  entity.merchantSafe = toChecksumAddress(event.params.merchantSafe);
  entity.issuingToken = makeToken(event.params.issuingToken);
  entity.feeCollected = event.params.amount;
  entity.save();
}
