import {
  CreatePrepaidCard,
  PrepaidCardManager,
  TransferredPrepaidCard,
  PrepaidCardSend,
} from '../../generated/PrepaidCard/PrepaidCardManager';
import {
  Depot,
  PrepaidCard,
  PrepaidCardCreation,
  PrepaidCardTransfer,
  PrepaidCardSendAction,
  MerchantSafe,
  MerchantPrepaidCardIssuance,
} from '../../generated/schema';
import {
  makeToken,
  makeEOATransaction,
  toChecksumAddress,
  makeTransaction,
  getPrepaidCardFaceValue,
  makeEOATransactionForSafe,
  makeAccount,
  setSafeType,
  makeMerchantRevenueEvent,
} from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleCreatePrepaidCard(event: CreatePrepaidCard): void {
  let prepaidCard = toChecksumAddress(event.params.card);
  let issuer = toChecksumAddress(event.params.issuer);
  let maybeDepot = toChecksumAddress(event.params.createdFromDepot);
  log.info('indexing new prepaid card {}', [prepaidCard]);
  let isDepot = Depot.load(maybeDepot) != null;
  if (isDepot) {
    makeEOATransactionForSafe(event, maybeDepot);
  } else {
    makeEOATransaction(event, issuer);
  }
  makeAccount(issuer);

  let txnHash = event.transaction.hash.toHex();
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
  creationEntity.transaction = txnHash;
  creationEntity.createdAt = event.block.timestamp;
  creationEntity.blockNumber = event.block.number;
  creationEntity.prepaidCard = prepaidCard;
  creationEntity.issuer = issuer;
  creationEntity.issuingToken = issuingToken;
  creationEntity.issuingTokenAmount = event.params.issuingTokenAmount;
  creationEntity.createdFromAddress = maybeDepot;
  if (isDepot) {
    creationEntity.depot = maybeDepot;
  }
  creationEntity.spendAmount = event.params.spendAmount;
  creationEntity.creationGasFeeCollected = event.params.gasFeeCollected;
  creationEntity.save();

  if (MerchantSafe.load(maybeDepot) != null) {
    let merchantPrepaidCardIssuanceEntity = new MerchantPrepaidCardIssuance(txnHash);
    merchantPrepaidCardIssuanceEntity.timestamp = event.block.timestamp;
    merchantPrepaidCardIssuanceEntity.transaction = txnHash;
    merchantPrepaidCardIssuanceEntity.merchantSafe = maybeDepot;
    merchantPrepaidCardIssuanceEntity.token = issuingToken;
    merchantPrepaidCardIssuanceEntity.amount = event.params.issuingTokenAmount;
    merchantPrepaidCardIssuanceEntity.prepaidCard = prepaidCard;
    merchantPrepaidCardIssuanceEntity.save();

    let revenueEventEntity = makeMerchantRevenueEvent(event, maybeDepot, issuingToken);
    revenueEventEntity.prepaidCardIssuance = txnHash;
    revenueEventEntity.save();
  }

  setSafeType(prepaidCard, 'prepaid-card');
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
  transferEntity.blockNumber = event.block.number;
  transferEntity.transaction = txnHash;
  transferEntity.prepaidCard = prepaidCard;
  transferEntity.from = from;
  transferEntity.to = to;
  transferEntity.save();
}

export function handleSendAction(event: PrepaidCardSend): void {
  makeTransaction(event);
  let txnHash = event.transaction.hash.toHex();
  let entity = new PrepaidCardSendAction(txnHash);
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.transaction = txnHash;
  entity.prepaidCard = toChecksumAddress(event.params.prepaidCard);
  entity.spendAmount = event.params.spendAmount;
  entity.rateLock = event.params.rateLock;
  entity.safeTxGas = event.params.safeTxGas;
  entity.baseGas = event.params.baseGas;
  entity.gasPrice = event.params.gasPrice;
  entity.action = event.params.action;
  entity.data = event.params.data;
  entity.ownerSignature = event.params.ownerSignature;
  entity.save();
}
