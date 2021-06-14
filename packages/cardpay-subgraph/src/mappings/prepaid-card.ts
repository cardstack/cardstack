import { ethereum } from '@graphprotocol/graph-ts';
import { CreatePrepaidCard, GasFeeCollected, PrepaidCardManager } from '../../generated/PrepaidCard/PrepaidCardManager';
import { Account, PrepaidCard, PrepaidCardCreation } from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';

export function handleCreatePrepaidCard(event: CreatePrepaidCard): void {
  assertTransactionExists(event);
  let issuer = toChecksumAddress(event.params.issuer);
  let accountEntity = new Account(issuer);
  accountEntity.save();

  let prepaidCardMgr = PrepaidCardManager.bind(event.address);
  let cardInfo = prepaidCardMgr.cardDetails(event.params.card);
  let reloadable = cardInfo.value4;
  let prepaidCard = toChecksumAddress(event.params.card);
  let issuingToken = toChecksumAddress(event.params.token);
  let prepaidCardEntity = new PrepaidCard(prepaidCard);
  prepaidCardEntity.safe = prepaidCard;
  prepaidCardEntity.customizationDID = event.params.customizationDID;
  prepaidCardEntity.issuingToken = issuingToken;
  prepaidCardEntity.issuer = issuer;
  prepaidCardEntity.owner = issuer;
  prepaidCardEntity.reloadable = reloadable;
  prepaidCardEntity.save();

  let creationEntity = assertPrepaidCardCreationExists(prepaidCard, event, issuer, issuingToken);
  creationEntity.amount = event.params.amount;
  creationEntity.save();
}

export function handleGasFeeCollected(event: GasFeeCollected): void {
  assertTransactionExists(event);
  let prepaidCard = toChecksumAddress(event.params.card);
  let issuer = toChecksumAddress(event.params.issuer);
  let creationEntity = assertPrepaidCardCreationExists(
    prepaidCard,
    event,
    issuer,
    toChecksumAddress(event.params.issuingToken)
  );
  creationEntity.creationGasFeeCollected = event.params.amount;
  creationEntity.save();
}

// TODO support prepaid card transfer events
// export function handleTransfer(event: TransferredPrepaidCard): void {
//
// }

function assertPrepaidCardCreationExists(
  prepaidCard: string,
  event: ethereum.Event,
  issuer: string,
  issuingToken: string
): PrepaidCardCreation {
  assertTransactionExists(event);
  let creationEntity = new PrepaidCardCreation(prepaidCard);
  creationEntity.transaction = event.transaction.hash.toHex();
  creationEntity.createdAt = event.block.timestamp;
  creationEntity.prepaidCard = prepaidCard;
  creationEntity.issuer = issuer;
  creationEntity.issuingToken = issuingToken;
  creationEntity.save();
  return creationEntity;
}
