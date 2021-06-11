import { SupplierWallet, SupplierInfoDID } from '../../generated/Depot/BridgeUtils';
import { TokensBridgedToSafe } from '../../generated/TokenBridge/HomeMultiAMBErc20ToErc677';
import { Depot, Account, BridgeEvent, Transaction, SupplierInfoDIDUpdate } from '../../generated/schema';
import { assertTransactionExists, toChecksumAddress } from '../utils';
import { log, BigInt } from '@graphprotocol/graph-ts';

export function handleCreateDepot(event: SupplierWallet): void {
  let supplier = toChecksumAddress(event.params.owner);
  let safe = toChecksumAddress(event.params.wallet);
  assertDepotExists(safe, supplier, event.block.timestamp);
}

export function handleTokensBridged(event: TokensBridgedToSafe): void {
  assertTransactionExists(event);

  let safe = toChecksumAddress(event.params.safe);
  let supplier = toChecksumAddress(event.params.recipient);
  assertDepotExists(safe, supplier, event.block.timestamp);

  let bridgeEventEntity = new BridgeEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  bridgeEventEntity.transaction = event.transaction.hash.toHex();
  bridgeEventEntity.depot = toChecksumAddress(event.params.safe);
  bridgeEventEntity.timestamp = event.block.timestamp;
  bridgeEventEntity.supplier = toChecksumAddress(event.params.recipient);
  bridgeEventEntity.token = toChecksumAddress(event.params.token);
  bridgeEventEntity.amount = event.params.value;
  bridgeEventEntity.save();
  log.debug('created bridge event entity {} for depot {}', [bridgeEventEntity.id, bridgeEventEntity.depot]);
}

export function handleSetInfoDID(event: SupplierInfoDID): void {
  assertTransactionExists(event);

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

function assertDepotExists(safe: string, supplier: string, timestamp: BigInt): void {
  let accountEntity = new Account(supplier);
  accountEntity.save();

  let depotEntity = new Depot(safe);
  depotEntity.safe = safe;
  depotEntity.createdAt = timestamp;
  depotEntity.supplier = supplier;
  depotEntity.save();
  log.debug('created depot entity {} for supplier', [safe, supplier]);
}
