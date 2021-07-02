import { SplitPrepaidCard as SplitPrepaidCardEvent } from '../../generated/Splits/SplitPrepaidCardHandler';
import { PrepaidCardSplit } from '../../generated/schema';
import { makeEOATransaction, makeTransaction, toChecksumAddress } from '../utils';

export function handlePrepaidCardSplit(event: SplitPrepaidCardEvent): void {
  makeTransaction(event);

  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let issuer = toChecksumAddress(event.params.issuer);
  let txnHash = event.transaction.hash.toHex();

  makeEOATransaction(event, issuer);

  let splitEntity = new PrepaidCardSplit(txnHash);
  splitEntity.timestamp = event.block.timestamp;
  splitEntity.transaction = txnHash;
  splitEntity.prepaidCard = prepaidCard;
  splitEntity.issuer = issuer;
  splitEntity.faceValues = event.params.spendAmounts;
  splitEntity.issuingTokenAmounts = event.params.issuingTokenAmounts;
  splitEntity.customizationDID = event.params.customizationDID;
  splitEntity.save();
}
