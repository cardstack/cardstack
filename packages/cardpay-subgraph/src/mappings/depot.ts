import { SupplierSafeCreated, SupplierInfoDIDUpdated } from '../../generated/Depot/SupplierManager';
import { TokensBridgedToSafe } from '../../generated/TokenBridge/HomeMultiAMBErc20ToErc677';
import { Depot, Account, BridgeEvent, SupplierInfoDIDUpdate } from '../../generated/schema';
import { makeToken, makeTransaction, toChecksumAddress } from '../utils';
import { log, BigInt } from '@graphprotocol/graph-ts';

export function handleCreateDepot(event: SupplierSafeCreated): void {
  let supplier = toChecksumAddress(event.params.supplier);
  let safe = toChecksumAddress(event.params.safe);
  makeDepot(safe, supplier, event.block.timestamp);
}

export function handleTokensBridged(event: TokensBridgedToSafe): void {
  makeTransaction(event);

  let safe = toChecksumAddress(event.params.safe);
  let supplier = toChecksumAddress(event.params.recipient);
  makeDepot(safe, supplier, event.block.timestamp);

  let bridgeEventEntity = new BridgeEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  bridgeEventEntity.transaction = event.transaction.hash.toHex();
  bridgeEventEntity.depot = toChecksumAddress(event.params.safe);
  bridgeEventEntity.timestamp = event.block.timestamp;
  bridgeEventEntity.supplier = toChecksumAddress(event.params.recipient);
  bridgeEventEntity.token = makeToken(event.params.token);
  bridgeEventEntity.amount = event.params.value;
  bridgeEventEntity.save();
  log.debug('created bridge event entity {} for depot {}', [bridgeEventEntity.id, bridgeEventEntity.depot]);
}

export function handleSetInfoDID(event: SupplierInfoDIDUpdated): void {
  makeTransaction(event);

  let supplier = toChecksumAddress(event.params.supplier);
  let infoDID = event.params.infoDID;

  let accountEntity = new Account(supplier);
  accountEntity.save();

  let updateEntity = new SupplierInfoDIDUpdate(event.transaction.hash.toHex());
  updateEntity.timestamp = event.block.timestamp;
  updateEntity.transaction = event.transaction.hash.toHex();
  updateEntity.infoDID = infoDID;
  updateEntity.supplier = supplier;
  updateEntity.save();
}

function makeDepot(safe: string, supplier: string, timestamp: BigInt): void {
  let accountEntity = new Account(supplier);
  accountEntity.save();

  let depotEntity = new Depot(safe);
  depotEntity.safe = safe;
  depotEntity.createdAt = timestamp;
  depotEntity.supplier = supplier;
  depotEntity.save();
  log.debug('created depot entity {} for supplier', [safe, supplier]);
}
