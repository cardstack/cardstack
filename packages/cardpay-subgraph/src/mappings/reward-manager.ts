import { RewardeeRegistered } from '../../generated/RewardManager/RewardManager';
import { RewardSafe } from '../../generated/schema';
import { toChecksumAddress, makeEOATransaction, makeAccount } from '../utils';

// To track creation of reward safe
export function handleRewardeeRegistration(event: RewardeeRegistered): void {
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let rewardee = toChecksumAddress(event.params.rewardee);
  let rewardSafe = toChecksumAddress(event.params.rewardSafe);
  makeAccount(rewardee);
  makeEOATransaction(event, rewardee);
  let entity = new RewardSafe(rewardSafe);
  entity.rewardProgramID = rewardProgramID;
  entity.rewardee = rewardee;
  entity.safe = rewardSafe;
  entity.save();
}
