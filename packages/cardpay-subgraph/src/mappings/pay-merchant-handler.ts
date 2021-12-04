import {
  CustomerPayment as MerchantPaymentEvent,
  MerchantFeeCollected as MerchantFeeEvent,
  PayMerchantHandler,
} from '../../generated/Payments/PayMerchantHandler';
import { RevenuePool } from '../../generated/Payments/RevenuePool';
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
    merchantSafe,
    issuingToken,
    event.params.issuingTokenAmount,
    event.params.spendAmount
  );

  let payMerchantHandler = PayMerchantHandler.bind(event.address);
  let revenuePool = RevenuePool.bind(payMerchantHandler.revenuePoolAddress());

  let revenueEntity = makeMerchantRevenue(merchantSafe, issuingToken);
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  revenueEntity.lifetimeAccumulation = revenueEntity.lifetimeAccumulation + event.params.issuingTokenAmount;
  revenueEntity.unclaimedBalance = revenuePool.revenueBalance(event.params.merchantSafe, event.params.issuingToken);
  revenueEntity.save();

  let revenueEventEntity = new MerchantRevenueEvent(txnHash);
  revenueEventEntity.transaction = txnHash;
  revenueEventEntity.timestamp = event.block.timestamp;
  revenueEventEntity.blockNumber = event.block.number;
  revenueEventEntity.merchantRevenue = revenueEntity.id;
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
  entity.blockNumber = event.block.number;
  entity.prepaidCard = toChecksumAddress(event.params.card);
  entity.merchantSafe = toChecksumAddress(event.params.merchantSafe);
  entity.issuingToken = makeToken(event.params.issuingToken);
  entity.feeCollected = event.params.amount;
  entity.save();
}
