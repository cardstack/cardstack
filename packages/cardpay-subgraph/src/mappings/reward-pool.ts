import {
  RewardeeClaim as RewardeeClaimEvent,
  RewardTokensAdded,
  MerkleRootSubmission,
} from '../../generated/RewardPool/RewardPool';
import {
  RewardeeClaim,
  RewardSafe,
  RewardTokensAdd,
  RewardProgram,
  MerkleRootSubmission,
} from '../../generated/schema';
import { toChecksumAddress, makeEOATransactionForSafe, makeAccount, makeToken } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleRewardeeClaim(event: RewardeeClaimEvent): void {
  let txnHash = event.transaction.hash.toHex();
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let rewardee = toChecksumAddress(event.params.rewardee);
  let rewardSafe = toChecksumAddress(event.params.rewardSafe);
  let token = makeToken(event.params.token);
  let amount = event.params.amount;
  let leaf = event.params.leaf;

  let rewardProgramEntity = RewardProgram.load(rewardProgramID);
  if (rewardProgramEntity == null) {
    log.warning(
      'Cannot process tokens added txn {}: Reward program entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, rewardProgramID]
    );
    return;
  }

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
  entity.rewardProgram = rewardProgramID;
  entity.rewardee = rewardee;
  entity.token = token;
  entity.amount = amount;
  entity.rewardSafe = rewardSafe;
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.leaf = leaf;
  entity.save();
}

export function handleRewardTokensAdded(event: RewardTokensAdded): void {
  let txnHash = event.transaction.hash.toHex();
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let safe = toChecksumAddress(event.params.sender);
  let token = makeToken(event.params.tokenAddress);
  let amount = event.params.amount;

  let rewardProgramEntity = RewardProgram.load(rewardProgramID);
  if (rewardProgramEntity == null) {
    log.warning(
      'Cannot process tokens added txn {}: Reward program entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, rewardProgramID]
    );
    return;
  }

  makeEOATransactionForSafe(event, safe);
  let entity = new RewardTokensAdd(txnHash);
  entity.rewardProgram = rewardProgramID;
  entity.safe = safe;
  entity.token = token;
  entity.amount = amount;
  entity.transaction = txnHash;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.save();
}

export function handleMerkleRootSubmission(event: MerkleRootSubmission): void {
  let txnHash = event.transaction.hash.toHex();
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let paymentCycle = event.params.paymentCycle;

  let rewardProgramEntity = RewardProgram.load(rewardProgramID);
  if (rewardProgramEntity == null) {
    log.warning(
      'Cannot process tokens added txn {}: Reward program entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, rewardProgramID]
    );
    return;
  }

  let entity = new MerkleRootSubmission(txnHash);
  entity.rewardProgram = rewardProgramID;
  entity.paymentCycle = paymentCycle;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.save();
}
