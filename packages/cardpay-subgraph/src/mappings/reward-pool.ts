import { RewardeeClaim as RewardeeClaimEvent, RewardTokensAdded } from '../../generated/RewardPool/RewardPool';
import { RewardeeClaim, RewardSafe, RewardTokensAdd } from '../../generated/schema';
import { toChecksumAddress, makeEOATransactionForSafe, makeAccount, makeToken } from '../utils';
import { log } from '@graphprotocol/graph-ts';

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

  let entity = new RewardeeClaim(txnHash);
  entity.rewardProgramID = rewardProgramID;
  entity.rewardee = rewardee;
  entity.amount = amount;
  entity.rewardSafe = rewardSafe;
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.save();
}

export function handleRewardTokensAdded(event: RewardTokensAdded): void {
  let txnHash = event.transaction.hash.toHex();
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let safe = toChecksumAddress(event.params.sender);
  let token = makeToken(event.params.tokenAddress);
  let amount = event.params.amount;

  makeEOATransactionForSafe(event, safe);
  let entity = new RewardTokensAdd(txnHash);
  entity.rewardProgramID = rewardProgramID;
  entity.safe = safe;
  entity.token = token;
  entity.amount = amount;
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.save();
}
