import { ScheduledPaymentModuleSetup } from '../generated/ScheduledPaymentModule/ScheduledPaymentModule';
import { Account, Safe, SafeOwner, SafeOwnerChange } from '../generated/schema';
import { toChecksumAddress } from './utils';
import { store } from '@graphprotocol/graph-ts';
import { AddedOwner, RemovedOwner } from '../generated/GnosisSafe/GnosisSafe';

export function handleScheduledPaymentModuleSetup(event: ScheduledPaymentModuleSetup): void {
  let safeAddress = toChecksumAddress(event.params.owner);
  let spModuleAddress = toChecksumAddress(event.params.moduleAddress);
  let safeOwners = event.params.avatarOwners;

  let safeEntity = new Safe(safeAddress);
  safeEntity.spModule = spModuleAddress;
  safeEntity.save();

  for (let i = 0; i < safeOwners.length; i++) {
    let ownerAddress = toChecksumAddress(safeOwners[i]);

    let accountEntity = new Account(ownerAddress);
    accountEntity.save();

    let safeOwnerId = safeAddress + '-' + ownerAddress;
    let safeOwnerEntity = new SafeOwner(safeOwnerId);
    safeOwnerEntity.owner = ownerAddress;
    safeOwnerEntity.safe = safeAddress;
    safeOwnerEntity.save();
  }
}

export function handleAddedOwner(event: AddedOwner): void {
  let txnHash = event.transaction.hash.toHex();
  let owner = toChecksumAddress(event.params.owner);
  let safeAddress = toChecksumAddress(event.address);
  let safe = Safe.load(safeAddress);
  if (safe == null) {
    // if we don't have this safe stored, it means there was an owner removed from some safe
    // that doesn't have the scheduled payment module, so we don't care about this particular addition
    return;
  }

  let accountEntity = new Account(owner);
  accountEntity.save();

  let safeOwnerEntity = new SafeOwner(safeAddress + '-' + owner);
  safeOwnerEntity.safe = safeAddress;
  safeOwnerEntity.owner = owner;
  safeOwnerEntity.save();

  let ownerChangeEntity = new SafeOwnerChange(safeAddress + '-add-' + owner + '-' + txnHash);
  ownerChangeEntity.txnHash = txnHash;
  ownerChangeEntity.timestamp = event.block.timestamp;
  ownerChangeEntity.safe = safeAddress;
  ownerChangeEntity.ownerAdded = owner;
  ownerChangeEntity.save();
}

export function handleRemovedOwner(event: RemovedOwner): void {
  let txnHash = event.transaction.hash.toHex();
  let safeAddress = toChecksumAddress(event.address);
  let owner = toChecksumAddress(event.params.owner);

  let safe = Safe.load(safeAddress);
  if (safe == null) {
    // if we don't have this safe stored, it means there was an owner removed from some safe
    // that doesn't have the scheduled payment module, so we don't care about this particular removal
    return;
  }

  let id = safeAddress + '-' + owner;
  store.remove('SafeOwner', id);

  let ownerChangeEntity = new SafeOwnerChange(safeAddress + '-remove-' + owner + '-' + txnHash);
  ownerChangeEntity.txnHash = txnHash;
  ownerChangeEntity.timestamp = event.block.timestamp;
  ownerChangeEntity.safe = safeAddress;
  ownerChangeEntity.ownerRemoved = owner;
  ownerChangeEntity.save();
}
