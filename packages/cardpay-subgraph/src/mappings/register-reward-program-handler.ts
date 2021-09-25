import { RewardProgramRegistrationFee } from '../../generated/RewardProgram/RegisterRewardProgramHandler';
import { log } from '@graphprotocol/graph-ts';

import { RewardProgramRegistrationPayment } from '../../generated/schema';
import { toChecksumAddress, makePrepaidCardPayment, makeToken, makeTransaction } from '../utils';

export function handleRewardProgramRegistrationFee(event: RewardProgramRegistrationFee): void {
  makeTransaction(event);
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let admin = toChecksumAddress(event.params.admin);
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let issuingToken = makeToken(event.params.issuingToken);
  let txnHash = event.transaction.hash.toHex();
  log.info('====prepaidCard {}', [prepaidCard]);
  log.info('====admin {}', [admin]);
  log.info('====rewardProgramID {}', [rewardProgramID]);

  makePrepaidCardPayment(
    event,
    prepaidCard,
    null,
    issuingToken,
    event.params.issuingTokenAmount,
    event.params.spendAmount
  );
  let entity = new RewardProgramRegistrationPayment(rewardProgramID);
  entity.admin = admin;
  entity.transaction = txnHash;
  entity.createdAt = event.block.timestamp;
  entity.prepaidCardPayment = txnHash;
  entity.paidWith = prepaidCard;
  entity.save();
}
