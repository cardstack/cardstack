import { BigInt } from '@graphprotocol/graph-ts';
import { ADDRESS_ZERO } from '@protofire/subgraph-toolkit';
import {
  MerchantCreation as MerchantCreationEvent,
  CustomerPayment as MerchantPaymentEvent,
  MerchantFeeCollected as MerchantFeeEvent,
  MerchantClaim as MerchantClaimEvent,
} from '../../generated/RevenuePool/RevenuePool';
import {
  Account,
  MerchantSafe,
  MerchantCreation,
  MerchantFeePayment,
  PrepaidCardPayment,
  PrepaidCard,
  MerchantRevenue,
  MerchantClaim,
  MerchantRevenueEvent,
} from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleMerchantPayment(event: MerchantPaymentEvent): void {
  assertTransactionExists(event);

  let prepaidCard = toChecksumAddress(event.params.card);
  let prepaidCardEntity = PrepaidCard.load(prepaidCard);
  let txnHash = event.transaction.hash.toHex();
  let merchantSafe = toChecksumAddress(event.params.merchantSafe);
  let issuingToken = toChecksumAddress(event.params.issuingToken);
  let revenueEntity = assertMerchantRevenueExists(merchantSafe, issuingToken);
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  revenueEntity.lifetimeAccumulation = revenueEntity.lifetimeAccumulation + event.params.issuingTokenAmount;
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  revenueEntity.unclaimedBalance = revenueEntity.unclaimedBalance + event.params.issuingTokenAmount;
  revenueEntity.save();

  if (prepaidCardEntity != null) {
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    prepaidCardEntity.spendBalance = prepaidCardEntity.spendBalance - event.params.spendAmount;
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    prepaidCardEntity.issuingTokenBalance = prepaidCardEntity.issuingTokenBalance - event.params.issuingTokenAmount;
    prepaidCardEntity.save();
  } else {
    log.warning(
      'Cannot process merchant payment txn {}: PrepaidCard entity does not exist for prepaid card {}. This is likely due to the subgraph having a startBlock that is higher than the block the prepaid card was created in.',
      [txnHash, prepaidCard]
    );
    return;
  }

  let paymentEntity = new PrepaidCardPayment(txnHash); // There will only ever be one merchant payment event per txn
  paymentEntity.transaction = txnHash;
  paymentEntity.timestamp = event.block.timestamp;
  paymentEntity.prepaidCard = prepaidCard;
  if (merchantSafe != ADDRESS_ZERO) {
    paymentEntity.merchantSafe = merchantSafe;
  }
  paymentEntity.issuingToken = issuingToken;
  paymentEntity.issuingTokenAmount = event.params.issuingTokenAmount;
  paymentEntity.spendAmount = event.params.spendAmount;
  paymentEntity.historicPrepaidCardIssuingTokenBalance = prepaidCardEntity.issuingTokenBalance;
  paymentEntity.historicPrepaidCardSpendBalance = prepaidCardEntity.spendBalance;
  paymentEntity.save();

  let revenueEventEntity = new MerchantRevenueEvent(txnHash);
  revenueEventEntity.transaction = txnHash;
  revenueEventEntity.timestamp = event.block.timestamp;
  revenueEventEntity.merchantRevenue = merchantSafe + '-' + issuingToken;
  revenueEventEntity.historicLifetimeAccumulation = revenueEntity.lifetimeAccumulation;
  revenueEventEntity.historicUnclaimedBalance = revenueEntity.unclaimedBalance;
  revenueEventEntity.prepaidCardPayment = txnHash;
  revenueEventEntity.save();
}

export function handleMerchantClaim(event: MerchantClaimEvent): void {
  assertTransactionExists(event);

  let txnHash = event.transaction.hash.toHex();
  let merchantSafe = toChecksumAddress(event.params.merchantSafe);
  let token = toChecksumAddress(event.params.payableToken);
  let revenueEntity = assertMerchantRevenueExists(merchantSafe, token);
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  revenueEntity.unclaimedBalance = revenueEntity.unclaimedBalance - event.params.amount;
  revenueEntity.save();

  let claimEntity = new MerchantClaim(txnHash);
  claimEntity.transaction = txnHash;
  claimEntity.timestamp = event.block.timestamp;
  claimEntity.merchantSafe = merchantSafe;
  claimEntity.token = token;
  claimEntity.amount = event.params.amount;
  claimEntity.save();

  let revenueEventEntity = new MerchantRevenueEvent(txnHash);
  revenueEventEntity.transaction = txnHash;
  revenueEventEntity.timestamp = event.block.timestamp;
  revenueEventEntity.merchantRevenue = merchantSafe + '-' + token;
  revenueEventEntity.historicLifetimeAccumulation = revenueEntity.lifetimeAccumulation;
  revenueEventEntity.historicUnclaimedBalance = revenueEntity.unclaimedBalance;
  revenueEventEntity.merchantClaim = txnHash;
  revenueEventEntity.save();
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

function assertMerchantRevenueExists(merchantSafe: string, token: string): MerchantRevenue {
  let id = merchantSafe + '-' + token;
  let entity = MerchantRevenue.load(id);
  if (entity == null) {
    entity = new MerchantRevenue(merchantSafe + '-' + token);
    entity.token = token;
    entity.merchantSafe = merchantSafe;
    entity.lifetimeAccumulation = new BigInt(0);
    entity.unclaimedBalance = new BigInt(0);
    entity.save();
  }
  return entity as MerchantRevenue;
}
