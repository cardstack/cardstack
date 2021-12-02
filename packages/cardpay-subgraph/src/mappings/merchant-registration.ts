import { MerchantRegistrationFee } from '../../generated/MerchantRegistration/RegisterMerchantHandler';
import { MerchantRegistrationPayment } from '../../generated/schema';
import { makeTransaction, makePrepaidCardPayment, toChecksumAddress, makeToken } from '../utils';

export function handleMerchantRegistrationFee(event: MerchantRegistrationFee): void {
  makeTransaction(event);

  let txnHash = event.transaction.hash.toHex();
  let prepaidCard = toChecksumAddress(event.params.card);
  let issuingToken = makeToken(event.params.issuingToken);

  makePrepaidCardPayment(
    event,
    prepaidCard,
    null,
    issuingToken,
    event.params.issuingTokenAmount,
    event.params.spendAmount
  );

  let registrationFeeEntity = new MerchantRegistrationPayment(txnHash);
  registrationFeeEntity.transaction = txnHash;
  registrationFeeEntity.createdAt = event.block.timestamp;
  registrationFeeEntity.blockNumber = event.block.number;
  registrationFeeEntity.paidWith = prepaidCard;
  registrationFeeEntity.prepaidCardPayment = txnHash;
  registrationFeeEntity.issuingToken = issuingToken;
  registrationFeeEntity.issuingTokenAmount = event.params.issuingTokenAmount;
  registrationFeeEntity.spendAmount = event.params.spendAmount;
  registrationFeeEntity.save();
}
