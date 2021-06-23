import { CreatePrepaidCard, PrepaidCardManager } from '../../generated/PrepaidCard/PrepaidCardManager';
import { Account, Depot, PrepaidCard, PrepaidCardCreation } from '../../generated/schema';
import { makeToken, makeTransaction, toChecksumAddress } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleCreatePrepaidCard(event: CreatePrepaidCard): void {
  let prepaidCard = toChecksumAddress(event.params.card);
  log.info('indexing new prepaid card {}', [prepaidCard]);
  makeTransaction(event);
  let issuer = toChecksumAddress(event.params.issuer);
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
  prepaidCardEntity.spendBalance = event.params.spendAmount;
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
  // TODO handle cards created from other prepaid cards (split cards)
  if (Depot.load(createdFrom) != null) {
    creationEntity.depot = createdFrom;
  }
  creationEntity.spendAmount = event.params.spendAmount;
  creationEntity.creationGasFeeCollected = event.params.gasFeeCollected;
  creationEntity.save();
}
