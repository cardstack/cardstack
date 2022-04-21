import { GnosisSafe } from '../../generated/Gnosis_v1_3/GnosisSafe';
import { GnosisSafe as GnosisSafeTemplate } from '../../generated/templates';
import { Safe, SafeOwner } from '../../generated/schema';
import { toChecksumAddress, makeAccount } from '../utils';
import { Address, ethereum, log } from '@graphprotocol/graph-ts';

// The following bad safe(s) are the confluence of this Gnosis issue:
// https://ethereum.stackexchange.com/questions/126648/call-reverts-when-asking-a-safe-for-its-owners-gnosis-chain
// and this graph protocol issue:
// https://github.com/graphprotocol/graph-node/issues/3487
let badSafes = new Map<string, boolean>();
badSafes.set('0x3af12EcC0A8Ef31cc935E0B25ea445249207d21A', true);

export function processGnosisProxyEvent(proxyAddress: Address, event: ethereum.Event, gnosisVer: string): void {
  let safeAddress = toChecksumAddress(proxyAddress);
  if (badSafes.has(safeAddress)) {
    log.error('Detected un-indexable safe address {}', [safeAddress]);
    return;
  }

  let safeEntity = new Safe(safeAddress);
  safeEntity.createdAt = event.block.timestamp;

  let safe = GnosisSafe.bind(proxyAddress);
  let ownersResult = safe.try_getOwners();
  if (ownersResult.reverted) {
    log.error('Failed to get owners for safe {}', [safeAddress]);
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
