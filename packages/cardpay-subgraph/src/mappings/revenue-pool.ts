import { MerchantClaim as MerchantClaimEvent, RevenuePool } from '../../generated/RevenuePool/RevenuePool';
import { MerchantClaim, MerchantRevenueEvent, MerchantSafe } from '../../generated/schema';
import { makeMerchantRevenue, makeToken, toChecksumAddress, makeEOATransactionForSafe } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleMerchantClaim(event: MerchantClaimEvent): void {
  let txnHash = event.transaction.hash.toHex();
  let merchantSafe = toChecksumAddress(event.params.merchantSafe);
  let merchantSafeEntity = MerchantSafe.load(merchantSafe);
  if (merchantSafeEntity == null) {
    log.warning(
      'Cannot process merchant revenue claim txn {}: MerchantSafe entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, merchantSafe]
    );
    return;
  }

  makeEOATransactionForSafe(event, merchantSafe);

  let token = makeToken(event.params.payableToken);
  let revenueEntity = makeMerchantRevenue(merchantSafe, token);
  let revenuePool = RevenuePool.bind(event.address);
  revenueEntity.unclaimedBalance = revenuePool.revenueBalance(event.params.merchantSafe, event.params.payableToken);
  revenueEntity.save();

  let claimEntity = new MerchantClaim(txnHash);
  claimEntity.transaction = txnHash;
  claimEntity.timestamp = event.block.timestamp;
  claimEntity.blockNumber = event.block.number;
  claimEntity.merchantSafe = merchantSafe;
  claimEntity.token = token;
  claimEntity.amount = event.params.amount;
  claimEntity.save();

  let revenueEventEntity = new MerchantRevenueEvent(txnHash);
  revenueEventEntity.transaction = txnHash;
  revenueEventEntity.timestamp = event.block.timestamp;
  revenueEventEntity.blockNumber = event.block.number;
  revenueEventEntity.merchantRevenue = revenueEntity.id;
  revenueEventEntity.historicLifetimeAccumulation = revenueEntity.lifetimeAccumulation;
  revenueEventEntity.historicUnclaimedBalance = revenueEntity.unclaimedBalance;
  revenueEventEntity.merchantClaim = txnHash;
  revenueEventEntity.save();
}
