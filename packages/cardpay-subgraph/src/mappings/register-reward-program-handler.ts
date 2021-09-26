import { RewardProgramRegistrationFee } from '../../generated/RegisterRewardProgram/RegisterRewardProgramHandler';
import { log } from '@graphprotocol/graph-ts';

import { RewardProgramRegistrationPayment } from '../../generated/schema';
import { toChecksumAddress, makePrepaidCardPayment, makeToken, makeAccount } from '../utils';

export function handleRewardProgramRegistrationFee(event: RewardProgramRegistrationFee): void {
  let txnHash = event.transaction.hash.toHex();
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let admin = toChecksumAddress(event.params.admin);
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let issuingToken = makeToken(event.params.issuingToken);

  log.info('====prepaidCard {}', [prepaidCard]);
  log.info('====admin {}', [admin]);
  log.info('====rewardProgramID {}', [rewardProgramID]);

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
  entity.admin = admin;
  entity.transaction = txnHash;
  entity.createdAt = event.block.timestamp;
  entity.prepaidCardPayment = txnHash;
  entity.rewardProgramID = rewardProgramID;
  entity.save();
}
