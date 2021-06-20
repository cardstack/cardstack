import { MerchantClaim as MerchantClaimEvent } from '../../generated/RevenuePool/RevenuePool';
import { MerchantClaim, MerchantRevenueEvent } from '../../generated/schema';
import { assertMerchantRevenueExists, assertTransactionExists, toChecksumAddress } from '../utils';

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
