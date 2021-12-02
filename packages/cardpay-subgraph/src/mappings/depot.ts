import { SupplierSafeCreated, SupplierInfoDIDUpdated } from '../../generated/Depot/SupplierManager';
import { TokensBridgedToSafe, TokensBridgingInitiated } from '../../generated/TokenBridge/HomeMultiAMBErc20ToErc677';
import { Depot, BridgeToLayer1Event, BridgeToLayer2Event, SupplierInfoDIDUpdate, Safe } from '../../generated/schema';
import {
  makeToken,
  makeEOATransaction,
  toChecksumAddress,
  makeEOATransactionForSafe,
  makeAccount,
  setSafeType,
} from '../utils';
import { log, BigInt, Address } from '@graphprotocol/graph-ts';
import { GnosisSafe } from '../../generated/Gnosis/GnosisSafe';

export function handleCreateDepot(event: SupplierSafeCreated): void {
  let supplier = toChecksumAddress(event.params.supplier);
  let safe = toChecksumAddress(event.params.safe);
  makeDepot(safe, supplier, event.block.timestamp);
}

export function handleReceivedBridgedTokens(event: TokensBridgedToSafe): void {
  let supplier = toChecksumAddress(event.params.recipient);

  let safe = toChecksumAddress(event.params.safe);
  makeDepot(safe, supplier, event.block.timestamp);
  makeEOATransactionForSafe(event, safe);

  let txnHash = event.transaction.hash.toHex();
  let bridgeEventEntity = new BridgeToLayer2Event(txnHash);
  bridgeEventEntity.transaction = txnHash;
  bridgeEventEntity.depot = toChecksumAddress(event.params.safe);
  bridgeEventEntity.timestamp = event.block.timestamp;
  bridgeEventEntity.blockNumber = event.block.number;
  bridgeEventEntity.supplier = toChecksumAddress(event.params.recipient);
  bridgeEventEntity.token = makeToken(event.params.token);
  bridgeEventEntity.amount = event.params.value;
  bridgeEventEntity.save();

  setSafeType(safe, 'depot');
  log.debug('created bridge event entity {} for depot {}', [bridgeEventEntity.id, bridgeEventEntity.depot]);
}

export function handleSentBridgedTokens(event: TokensBridgingInitiated): void {
  let sender = toChecksumAddress(event.params.sender);
  let txnHash = event.transaction.hash.toHex();

  let bridgeEventEntity = new BridgeToLayer1Event(txnHash);
  bridgeEventEntity.transaction = txnHash;
  bridgeEventEntity.timestamp = event.block.timestamp;
  bridgeEventEntity.blockNumber = event.block.number;
  bridgeEventEntity.token = makeToken(event.params.token);
  bridgeEventEntity.amount = event.params.value;

  let safe = Safe.load(sender);
  if (safe != null) {
    bridgeEventEntity.safe = safe.id;
    makeEOATransactionForSafe(event, safe.id);
    let safeContract = GnosisSafe.bind(Address.fromString(safe.id));
    let owners = safeContract.getOwners();
    if (owners.length > 0) {
      let account = makeAccount(toChecksumAddress(owners[0]));
      bridgeEventEntity.account = account.id;
    }
  } else {
    makeAccount(sender);
    bridgeEventEntity.account = sender;
    makeEOATransaction(event, sender);
  }
  bridgeEventEntity.save();
}

export function handleSetInfoDID(event: SupplierInfoDIDUpdated): void {
  let supplier = toChecksumAddress(event.params.supplier);
  makeEOATransaction(event, supplier);

  let infoDID = event.params.infoDID;

  makeAccount(supplier);

  let updateEntity = new SupplierInfoDIDUpdate(event.transaction.hash.toHex());
  updateEntity.timestamp = event.block.timestamp;
  updateEntity.blockNumber = event.block.number;
  updateEntity.transaction = event.transaction.hash.toHex();
  updateEntity.infoDID = infoDID;
  updateEntity.supplier = supplier;
  updateEntity.save();
}

function makeDepot(safe: string, supplier: string, timestamp: BigInt): void {
  makeAccount(supplier);

  let depotEntity = new Depot(safe);
  depotEntity.safe = safe;
  depotEntity.createdAt = timestamp;
  depotEntity.supplier = supplier;
  depotEntity.save();
  log.debug('created depot entity {} for supplier', [safe, supplier]);
}
