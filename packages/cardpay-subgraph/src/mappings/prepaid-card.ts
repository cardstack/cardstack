import {
  CreatePrepaidCard,
  PrepaidCardManager,
  TransferredPrepaidCard,
} from '../../generated/PrepaidCard/PrepaidCardManager';
import { Account, Depot, PrepaidCard, PrepaidCardCreation, PrepaidCardTransfer } from '../../generated/schema';
import { makeToken, makeEOATransaction, toChecksumAddress, makeTransaction, getPrepaidCardFaceValue } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleCreatePrepaidCard(event: CreatePrepaidCard): void {
  let prepaidCard = toChecksumAddress(event.params.card);
  let issuer = toChecksumAddress(event.params.issuer);
  log.info('indexing new prepaid card {}', [prepaidCard]);
  makeEOATransaction(event, issuer);
  let accountEntity = new Account(issuer);
  accountEntity.save();

  let prepaidCardMgr = PrepaidCardManager.bind(event.address);
  let cardInfo = prepaidCardMgr.cardDetails(event.params.card);
  let reloadable = cardInfo.value4;
  let issuingToken = makeToken(event.params.token);

  let prepaidCardEntity = new PrepaidCard(prepaidCard);
  prepaidCardEntity.safe = prepaidCard;
  prepaidCardEntity.customizationDID = event.params.customizationDID;
  prepaidCardEntity.issuingToken = issuingToken;
  prepaidCardEntity.issuer = issuer;
  prepaidCardEntity.owner = issuer;
  prepaidCardEntity.reloadable = reloadable;
  prepaidCardEntity.faceValue = getPrepaidCardFaceValue(prepaidCard);
  prepaidCardEntity.issuingTokenBalance = event.params.issuingTokenAmount;
  prepaidCardEntity.save();

  let creationEntity = new PrepaidCardCreation(prepaidCard);
  creationEntity.transaction = event.transaction.hash.toHex();
  creationEntity.createdAt = event.block.timestamp;
  creationEntity.prepaidCard = prepaidCard;
  creationEntity.issuer = issuer;
  creationEntity.issuingToken = issuingToken;
  creationEntity.issuingTokenAmount = event.params.issuingTokenAmount;
  let createdFrom = toChecksumAddress(event.params.createdFromDepot);
  creationEntity.createdFromAddress = createdFrom;
  if (Depot.load(createdFrom) != null) {
    creationEntity.depot = createdFrom;
  }
  creationEntity.spendAmount = event.params.spendAmount;
  creationEntity.creationGasFeeCollected = event.params.gasFeeCollected;
  creationEntity.save();
}

export function handleTransferPrepaidCard(event: TransferredPrepaidCard): void {
  makeTransaction(event);

  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let from = toChecksumAddress(event.params.previousOwner);
  let to = toChecksumAddress(event.params.newOwner);
  let txnHash = event.transaction.hash.toHex();

  makeEOATransaction(event, from);
  makeEOATransaction(event, to);

  let prepaidCardEntity = PrepaidCard.load(prepaidCard);
  if (prepaidCardEntity == null) {
    log.warning(
      'Cannot process transfer prepaid card txn {}: PrepaidCard entity does not exist for prepaid card {}. This is likely due to the subgraph having a startBlock that is higher than the block the prepaid card was created in.',
      [txnHash, prepaidCard]
    );
    return;
  }
  prepaidCardEntity.owner = to;
  prepaidCardEntity.save();

  let transferEntity = new PrepaidCardTransfer(txnHash);
  transferEntity.timestamp = event.block.timestamp;
  transferEntity.transaction = txnHash;
  transferEntity.prepaidCard = prepaidCard;
  transferEntity.from = from;
  transferEntity.to = to;
  transferEntity.save();
}
