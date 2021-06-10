import { ProxyCreation } from '../../generated/Gnosis/GnosisProxyFactory';
import { GnosisSafe } from '../../generated/Gnosis/GnosisSafe';
import { GnosisSafe as GnosisSafeTemplate } from '../../generated/templates';
import { Safe, Owner, SafeOwner } from '../../generated/schema';
import { toChecksumAddress } from '../utils';

export function handleProxyCreation(event: ProxyCreation): void {
  let safeAddress = toChecksumAddress(event.params.proxy);
  let safeEntity = new Safe(safeAddress);
  safeEntity.createdAt = event.block.timestamp;

  let safe = GnosisSafe.bind(event.params.proxy);
  let owners = safe.getOwners();

  for (let i = 0; i < owners.length; i++) {
    let ownerAddress = toChecksumAddress(owners[i]);
    let ownerEntity = new Owner(ownerAddress);
    ownerEntity.save();

    let safeOwnerId = safeAddress + '-' + ownerAddress;
    let safeOwnerEntity = new SafeOwner(safeOwnerId);
    safeOwnerEntity.owner = ownerAddress;
    safeOwnerEntity.safe = safeAddress;
    safeOwnerEntity.save();
  }
  safeEntity.save();

  GnosisSafeTemplate.create(event.params.proxy);
}
