import { CreatePrepaidCard, PrepaidCardManager } from '../../generated/PrepaidCard/PrepaidCardManager';
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
  creationEntity.spendAmount = event.params.spendAmount;
  creationEntity.creationGasFeeCollected = event.params.gasFeeCollected;
  creationEntity.save();
}
