import { RewardeeRegistrationFee } from '../../generated/RegisterRewardee/RegisterRewardeeHandler';
import { RewardeeRegistrationPayment, RewardProgram } from '../../generated/schema';
import { toChecksumAddress, makePrepaidCardPayment, makeToken, makeAccount, getPrepaidCardOwner } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleRewardeeRegistrationFee(event: RewardeeRegistrationFee): void {
  let txnHash = event.transaction.hash.toHex();
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let issuingToken = makeToken(event.params.issuingToken);
  let rewardee = toChecksumAddress(getPrepaidCardOwner(prepaidCard));

  let rewardProgramEntity = RewardProgram.load(rewardProgramID);
  if (rewardProgramEntity == null) {
    log.warning(
      'Cannot process tokens added txn {}: Reward program entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, rewardProgramID]
    );
    return;
  }
  makeAccount(rewardee);
  makePrepaidCardPayment(
    event,
    prepaidCard,
    null,
    issuingToken,
    event.params.issuingTokenAmount,
    event.params.spendAmount
  );
  let entity = new RewardeeRegistrationPayment(txnHash);
  entity.transaction = txnHash;
  entity.rewardee = rewardee;
  entity.createdAt = event.block.timestamp;
  entity.prepaidCardPayment = txnHash;
  entity.rewardProgram = rewardProgramID;
  entity.save();
}
