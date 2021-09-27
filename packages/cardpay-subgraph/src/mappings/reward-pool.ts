import { RewardeeClaim as RewardeeClaimEvent } from '../../generated/RewardPool/RewardPool';
import { RewardeeClaim, RewardSafe } from '../../generated/schema';
import { toChecksumAddress, makeEOATransactionForSafe, makeAccount } from '../utils';
import { log } from '@graphprotocol/graph-ts';
// To track creation of reward safe
export function handleRewardeeClaim(event: RewardeeClaimEvent): void {
  let txnHash = event.transaction.hash.toHex();
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let rewardee = toChecksumAddress(event.params.rewardee);
  let rewardSafe = toChecksumAddress(event.params.rewardSafe);
  let amount = event.params.amount;

  let rewardSafeEntity = RewardSafe.load(rewardSafe);
  if (rewardSafeEntity == null) {
    log.warning(
      'Cannot process rewardee claim txn {}: RewardSafe entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, rewardSafe]
    );
    return;
  }
  makeAccount(rewardee);
  makeEOATransactionForSafe(event, rewardSafe);

  log.info('=====================Tom Cardy {}', [rewardSafe]);

  log.info('====rewardSafe {}', [rewardSafe]);
  let entity = new RewardeeClaim(txnHash);
  entity.rewardProgramID = rewardProgramID;
  entity.rewardee = rewardee;
  entity.amount = amount;
  entity.rewardSafe = rewardSafe;
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.save();
}
