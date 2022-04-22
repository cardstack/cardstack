import { GnosisSafe } from '../../generated/Gnosis_v1_3/GnosisSafe';
import { GnosisSafe as GnosisSafeTemplate } from '../../generated/templates';
import { Safe, SafeOwner } from '../../generated/schema';
import { toChecksumAddress, makeAccount } from '../utils';
import { Address, ethereum, log } from '@graphprotocol/graph-ts';

export function processGnosisProxyEvent(proxyAddress: Address, event: ethereum.Event, gnosisVer: string): void {
  let safeAddress = toChecksumAddress(proxyAddress);
  let safeEntity = new Safe(safeAddress);
  safeEntity.createdAt = event.block.timestamp;

  let safe = GnosisSafe.bind(proxyAddress);
  let threshold = safe.try_getThreshold();
  if (threshold.reverted || threshold.value.toI32() == 0) {
    log.warning('Detected uninitialized safe: {}', [safeAddress]);
    return;
  }
  let ownersResult = safe.try_getOwners();
  if (ownersResult.reverted) {
    log.warning('Failed to get owners for safe {}', [safeAddress]);
    return;
  }
  let owners = safe.getOwners();

  for (let i = 0; i < owners.length; i++) {
    let ownerAddress = toChecksumAddress(owners[i]);
    makeAccount(ownerAddress);

    let safeOwnerId = safeAddress + '-' + ownerAddress;
    let safeOwnerEntity = new SafeOwner(safeOwnerId);
    safeOwnerEntity.owner = ownerAddress;
    safeOwnerEntity.safe = safeAddress;
    safeOwnerEntity.createdAt = event.block.timestamp;
    safeOwnerEntity.ownershipChangedAt = event.block.timestamp;
    safeOwnerEntity.save();
  }
  safeEntity.save();
  log.debug('created gnosis v{} safe entity {}', [gnosisVer, safeAddress]);

  GnosisSafeTemplate.create(proxyAddress);
}
