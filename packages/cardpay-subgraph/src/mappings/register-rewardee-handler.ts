import { RewardeeRegistrationFee } from '../../generated/RegisterRewardee/RegisterRewardeeHandler';
import { log } from '@graphprotocol/graph-ts';
import { RewardeeRegistrationPayment } from '../../generated/schema';
import {
  toChecksumAddress,
  makePrepaidCardPayment,
  makeToken,
  makeAccount,
  getPrepaidCardOwner,
} from '../utils';

export function handleRewardeeRegistrationFee(event: RewardeeRegistrationFee): void {
  let txnHash = event.transaction.hash.toHex();
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let rewardProgramID = toChecksumAddress(event.params.rewardProgramID);
  let issuingToken = makeToken(event.params.issuingToken);

  log.info('====prepaidCard {}', [prepaidCard]);
  log.info('====rewardProgramID {}', [rewardProgramID]);

  let rewardee = getPrepaidCardOwner(prepaidCard).toString();
  makeAccount(rewardee);
  log.info('====rewardee {}', [rewardee]);
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
  entity.rewardProgramID = rewardProgramID;

  entity.save();
}
