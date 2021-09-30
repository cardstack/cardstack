import { RewardeeRegistered } from '../../generated/RewardManager/RewardManager';
import { RewardSafe, RewardProgram } from '../../generated/schema';
import { toChecksumAddress, makeEOATransaction, makeAccount } from '../utils';
import { log } from '@graphprotocol/graph-ts';

// To track creation of reward safe
export function handleRewardeeRegistration(event: RewardeeRegistered): void {
  let txnHash = event.transaction.hash.toHex();
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let rewardee = toChecksumAddress(event.params.rewardee);
  let rewardSafe = toChecksumAddress(event.params.rewardSafe);

  let rewardProgramEntity = RewardProgram.load(rewardProgramID);
  if (rewardProgramEntity == null) {
    log.warning(
      'Cannot process tokens added txn {}: Reward program entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, rewardProgramID]
    );
    return;
  }

  makeAccount(rewardee);
  makeEOATransaction(event, rewardee);

  let entity = new RewardSafe(rewardSafe);
  entity.rewardProgram = rewardProgramID;
  entity.rewardee = rewardee;
  entity.safe = rewardSafe;
  entity.save();
}
