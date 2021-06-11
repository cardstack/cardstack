import { SupplierWallet, SupplierInfoDID } from '../../generated/Depot/BridgeUtils';
import { TokensBridgedToSafe } from '../../generated/TokenBridge/HomeMultiAMBErc20ToErc677';
import { Depot, Account, BridgeEvent } from '../../generated/schema';
import { toChecksumAddress } from '../utils';
import { log, BigInt } from '@graphprotocol/graph-ts';

export function handleCreateDepot(event: SupplierWallet): void {
  let supplier = toChecksumAddress(event.params.owner);
  let safe = toChecksumAddress(event.params.wallet);
  assertDepotExists(safe, supplier, event.block.timestamp);
}

export function handleTokensBridged(event: TokensBridgedToSafe): void {
  let safe = toChecksumAddress(event.params.safe);
  let supplier = toChecksumAddress(event.params.recipient);
  assertDepotExists(safe, supplier, event.block.timestamp);

  let bridgeEventEntity = new BridgeEvent(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  bridgeEventEntity.depot = toChecksumAddress(event.params.safe);
  bridgeEventEntity.timestamp = event.block.timestamp;
  bridgeEventEntity.supplier = toChecksumAddress(event.params.recipient);
  bridgeEventEntity.token = toChecksumAddress(event.params.token);
  bridgeEventEntity.amount = event.params.value;
  bridgeEventEntity.save();
  log.debug('created bridge event entity {} for depot {}', [bridgeEventEntity.id, bridgeEventEntity.depot]);
}

export function handleSetInfoDID(event: SupplierInfoDID): void {}

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
