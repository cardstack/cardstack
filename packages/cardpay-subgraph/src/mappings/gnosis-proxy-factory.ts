import { ProxyCreation } from '../../generated/Gnosis/GnosisProxyFactory';
import { GnosisSafe } from '../../generated/Gnosis/GnosisSafe';
import { GnosisSafe as GnosisSafeTemplate } from '../../generated/templates';
import { Safe, Account, SafeOwner } from '../../generated/schema';
import { toChecksumAddress } from '../utils';
import { log } from '@graphprotocol/graph-ts';

export function handleProxyCreation(event: ProxyCreation): void {
  let safeAddress = toChecksumAddress(event.params.proxy);
  let safeEntity = new Safe(safeAddress);
  safeEntity.createdAt = event.block.timestamp;
  safeEntity.ownershipChangedAt = event.block.timestamp;

  let safe = GnosisSafe.bind(event.params.proxy);
  let owners = safe.getOwners();

  for (let i = 0; i < owners.length; i++) {
    let ownerAddress = toChecksumAddress(owners[i]);
    let ownerEntity = new Account(ownerAddress);
    ownerEntity.save();

    let safeOwnerId = safeAddress + '-' + ownerAddress;
    let safeOwnerEntity = new SafeOwner(safeOwnerId);
    safeOwnerEntity.owner = ownerAddress;
    safeOwnerEntity.safe = safeAddress;
    safeOwnerEntity.createdAt = event.block.timestamp;
    safeOwnerEntity.save();
  }
  safeEntity.save();
  log.debug('created safe entity {}', [safeAddress]);

  GnosisSafeTemplate.create(event.params.proxy);
}
