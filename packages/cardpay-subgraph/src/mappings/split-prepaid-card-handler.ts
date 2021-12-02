import { BigInt } from '@graphprotocol/graph-ts';
import { SplitPrepaidCard as SplitPrepaidCardEvent } from '../../generated/Splits/SplitPrepaidCardHandler';
import { PrepaidCardSplit } from '../../generated/schema';
import { makeEOATransaction, makePrepaidCardPayment, makeTransaction, toChecksumAddress } from '../utils';

export function handlePrepaidCardSplit(event: SplitPrepaidCardEvent): void {
  makeTransaction(event);

  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let issuer = toChecksumAddress(event.params.issuer);
  let txnHash = event.transaction.hash.toHex();

  makeEOATransaction(event, issuer);

  let issuingTokenAmount = new BigInt(0);
  let tokenAmounts = event.params.issuingTokenAmounts;
  for (let i = 0; i < tokenAmounts.length; i++) {
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    issuingTokenAmount += tokenAmounts[i];
  }
  makePrepaidCardPayment(
    event,
    prepaidCard,
    null,
    toChecksumAddress(event.params.issuingToken),
    issuingTokenAmount,
    null
  );

  let splitEntity = new PrepaidCardSplit(txnHash);
  splitEntity.timestamp = event.block.timestamp;
  splitEntity.blockNumber = event.block.number;
  splitEntity.transaction = txnHash;
  splitEntity.prepaidCard = prepaidCard;
  splitEntity.issuer = issuer;
  splitEntity.faceValues = event.params.spendAmounts;
  splitEntity.issuingTokenAmounts = event.params.issuingTokenAmounts;
  splitEntity.customizationDID = event.params.customizationDID;
  splitEntity.save();
}
