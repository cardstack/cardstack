import { RewardProgramRegistrationFee } from '../../generated/RegisterRewardProgram/RegisterRewardProgramHandler';

import { RewardProgramRegistrationPayment } from '../../generated/schema';
import { toChecksumAddress, makePrepaidCardPayment, makeToken, makeAccount } from '../utils';

export function handleRewardProgramRegistrationFee(event: RewardProgramRegistrationFee): void {
  let txnHash = event.transaction.hash.toHex();
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let admin = toChecksumAddress(event.params.admin);
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let issuingToken = makeToken(event.params.issuingToken);

  makeAccount(admin);
  makePrepaidCardPayment(
    event,
    prepaidCard,
    null,
    issuingToken,
    event.params.issuingTokenAmount,
    event.params.spendAmount
  );
  let entity = new RewardProgramRegistrationPayment(txnHash);
  entity.rewardProgramID = rewardProgramID;
  entity.admin = admin;
  entity.transaction = txnHash;
  entity.createdAt = event.block.timestamp;
  entity.prepaidCardPayment = txnHash;
  entity.save();
}
