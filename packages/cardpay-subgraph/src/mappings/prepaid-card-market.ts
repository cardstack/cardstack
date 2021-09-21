import {
  ProvisionedPrepaidCard,
  ItemSet,
  ItemRemoved,
  AskSet,
  PrepaidCardMarket,
} from '../../generated/Market/PrepaidCardMarket';
import { ethereum, BigInt, store } from '@graphprotocol/graph-ts';
import {
  Account,
  PrepaidCardAsk,
  PrepaidCardAskSetEvent,
  PrepaidCardInventoryAddEvent,
  PrepaidCardInventoryEvent,
  PrepaidCardInventoryItem,
  PrepaidCardInventoryRemoveEvent,
  PrepaidCardProvisionedEvent,
  SKU,
  SKUInventory,
} from '../../generated/schema';
import { makeToken, makeEOATransaction, toChecksumAddress } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleProvisionedPrepaidCard(event: ProvisionedPrepaidCard): void {
  let txnHash = event.transaction.hash.toHex();
  let timestamp = event.block.timestamp;
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let customer = toChecksumAddress(event.params.customer);
  let sku = event.params.sku.toHex();
  let askPrice = event.params.askPrice;
  let accountEntity = new Account(customer);
  accountEntity.save();

  makeEOATransaction(event, customer);
  let itemId = sku + '-' + prepaidCard;
  let inventoryItemEntity = PrepaidCardInventoryItem.load(itemId);
  if (inventoryItemEntity == null) {
    log.warning(
      'Cannot process ProvisionedPrepaidCard txn {}: PrepaidCardInventoryItem entity does not exist for sku {} and prepaid card {}. This is likely due to the subgraph having a startBlock that is higher than the block the inventory item was created in.',
      [txnHash, sku, prepaidCard]
    );
    return;
  }
  store.remove('PrepaidCardInventoryItem', itemId);

  let provisionedEventEntity = new PrepaidCardProvisionedEvent(txnHash + '-' + prepaidCard);
  provisionedEventEntity.timestamp = timestamp;
  provisionedEventEntity.transaction = txnHash;
  provisionedEventEntity.prepaidCard = prepaidCard;
  provisionedEventEntity.customer = customer;
  provisionedEventEntity.inventory = sku;
  provisionedEventEntity.askPrice = askPrice;
  provisionedEventEntity.save();

  let inventoryEventEntity = makeInventoryEvent(sku, prepaidCard, event);
  inventoryEventEntity.inventoryProvisioned = provisionedEventEntity.id;
  inventoryEventEntity.save();
}

export function handleItemSet(event: ItemSet): void {
  let txnHash = event.transaction.hash.toHex();
  let timestamp = event.block.timestamp;
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let issuer = toChecksumAddress(event.params.issuer);
  let sku = event.params.sku.toHex();
  let accountEntity = new Account(issuer);
  accountEntity.save();

  makeEOATransaction(event, issuer);
  let issuingToken = makeToken(event.params.issuingToken);
  makeSkuEntity(sku, issuer, issuingToken, event.params.faceValue, event.params.customizationDID);
  let market = PrepaidCardMarket.bind(event.address);
  let askPrice = market.asks(event.params.sku);
  makeInventory(sku, issuer, askPrice);
  makeInventoryItem(sku, prepaidCard);

  let addEventEntity = new PrepaidCardInventoryAddEvent(txnHash + '-' + prepaidCard);
  addEventEntity.timestamp = timestamp;
  addEventEntity.transaction = txnHash;
  addEventEntity.prepaidCard = prepaidCard;
  addEventEntity.inventory = sku;
  addEventEntity.save();

  let inventoryEventEntity = makeInventoryEvent(sku, prepaidCard, event);
  inventoryEventEntity.inventoryAdded = addEventEntity.id;
  inventoryEventEntity.save();
}

export function handleAskSet(event: AskSet): void {
  let txnHash = event.transaction.hash.toHex();
  let timestamp = event.block.timestamp;
  let askPrice = event.params.askPrice;
  let sku = event.params.sku.toHex();
  let issuer = toChecksumAddress(event.params.issuer);
  let accountEntity = new Account(issuer);
  accountEntity.save();

  makeEOATransaction(event, issuer);
  let issuingToken = makeToken(event.params.issuingToken);
  let askEntity = new PrepaidCardAsk(sku);
  askEntity.sku = sku;
  askEntity.issuingToken = issuingToken;
  askEntity.askPrice = askPrice;
  askEntity.save();

  let askEventEntity = new PrepaidCardAskSetEvent(txnHash);
  askEventEntity.timestamp = timestamp;
  askEventEntity.transaction = txnHash;
  askEventEntity.sku = sku;
  askEventEntity.issuingToken = issuingToken;
  askEventEntity.askPrice = askPrice;
  askEventEntity.save();
}

export function handleItemRemoved(event: ItemRemoved): void {
  let txnHash = event.transaction.hash.toHex();
  let timestamp = event.block.timestamp;
  let prepaidCard = toChecksumAddress(event.params.prepaidCard);
  let issuer = toChecksumAddress(event.params.issuer);
  let sku = event.params.sku.toHex();
  let accountEntity = new Account(issuer);
  accountEntity.save();

  makeEOATransaction(event, issuer);
  let itemId = sku + '-' + prepaidCard;
  let inventoryItemEntity = PrepaidCardInventoryItem.load(itemId);
  if (inventoryItemEntity == null) {
    log.warning(
      'Cannot process ItemRemoved txn {}: PrepaidCardInventoryItem entity does not exist for sku {} and prepaid card {}. This is likely due to the subgraph having a startBlock that is higher than the block the inventory item was created in.',
      [txnHash, sku, prepaidCard]
    );
    return;
  }
  store.remove('PrepaidCardInventoryItem', itemId);

  let removeEventEntity = new PrepaidCardInventoryRemoveEvent(txnHash + '-' + prepaidCard);
  removeEventEntity.timestamp = timestamp;
  removeEventEntity.transaction = txnHash;
  removeEventEntity.prepaidCard = prepaidCard;
  removeEventEntity.inventory = sku;
  removeEventEntity.save();

  let inventoryEventEntity = makeInventoryEvent(sku, prepaidCard, event);
  inventoryEventEntity.inventoryRemoved = removeEventEntity.id;
  inventoryEventEntity.save();
}

function makeSkuEntity(
  sku: string,
  issuer: string,
  issuingToken: string,
  faceValue: BigInt,
  customizationDID: string
): SKU {
  let entity = new SKU(sku);
  entity.issuer = issuer;
  entity.issuingToken = issuingToken;
  entity.faceValue = faceValue;
  entity.customizationDID = customizationDID;
  entity.save();
  return entity;
}

function makeInventory(sku: string, issuer: string, askPrice: BigInt): SKUInventory {
  let entity = new SKUInventory(sku);
  entity.issuer = issuer;
  entity.sku = sku;
  entity.askPrice = askPrice;
  entity.save();
  return entity;
}

function makeInventoryItem(sku: string, prepaidCard: string): PrepaidCardInventoryItem {
  let id = sku + '-' + prepaidCard;
  let entity = new PrepaidCardInventoryItem(id);
  entity.inventory = sku;
  entity.prepaidCardId = prepaidCard;
  entity.prepaidCard = prepaidCard;
  entity.save();
  return entity;
}

function makeInventoryEvent(sku: string, prepaidCard: string, event: ethereum.Event): PrepaidCardInventoryEvent {
  let txnHash = event.transaction.hash.toHex();
  let timestamp = event.block.timestamp;
  let id = txnHash + '-' + prepaidCard;
  let entity = new PrepaidCardInventoryEvent(id);
  entity.timestamp = timestamp;
  entity.transaction = txnHash;
  entity.inventory = sku;
  entity.prepaidCard = prepaidCard;
  return entity;
}
