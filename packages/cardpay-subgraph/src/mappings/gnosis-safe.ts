import { Address, store } from '@graphprotocol/graph-ts';
import { ExecutionSuccess, AddedOwner, RemovedOwner } from '../../generated/templates/GnosisSafe/GnosisSafe';
import { toChecksumAddress, makeEOATransactionForSafe, makeToken } from '../utils';
import { decode, encodeMethodSignature, methodHashFromEncodedHex } from '../abi';
import {
  Safe,
  SafeOwner,
  SafeTransaction,
  SafeOwnerChange,
  PrepaidCard,
  MerchantSafe,
  Depot,
  RewardSafe,
} from '../../generated/schema';
import { log } from '@graphprotocol/graph-ts';

const EXEC_TRANSACTION = 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)';

export function handleAddedOwner(event: AddedOwner): void {
  let txnHash = event.transaction.hash.toHex();
  let owner = toChecksumAddress(event.params.owner);
  let safeAddress = toChecksumAddress(event.address);
  let safe = Safe.load(safeAddress);
  if (safe == null) {
    log.warning(
      'Cannot process safe txn {}: Safe entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, safeAddress]
    );
    return;
  }
  safe.save();

  let safeOwnerEntity = new SafeOwner(safeAddress + '-' + owner);
  safeOwnerEntity.safe = safeAddress;
  safeOwnerEntity.owner = owner;
  safeOwnerEntity.createdAt = safe.createdAt;
  safeOwnerEntity.ownershipChangedAt = event.block.timestamp;
  if (PrepaidCard.load(safeAddress) != null) {
    safeOwnerEntity.type = 'prepaid-card';
  } else if (MerchantSafe.load(safeAddress) != null) {
    safeOwnerEntity.type = 'merchant';
  } else if (Depot.load(safeAddress) != null) {
    safeOwnerEntity.type = 'depot';
  } else if (RewardSafe.load(safeAddress) != null) {
    safeOwnerEntity.type = 'reward';
  }
  safeOwnerEntity.save();

  let ownerChangeEntity = new SafeOwnerChange(safeAddress + '-add-' + owner + '-' + txnHash);
  ownerChangeEntity.transaction = txnHash;
  ownerChangeEntity.timestamp = event.block.timestamp;
  ownerChangeEntity.safe = safeAddress;
  ownerChangeEntity.ownerAdded = owner;
  ownerChangeEntity.save();
}

export function handleRemovedOwner(event: RemovedOwner): void {
  let txnHash = event.transaction.hash.toHex();
  let safeAddress = toChecksumAddress(event.address);
  let owner = toChecksumAddress(event.params.owner);
  let id = safeAddress + '-' + owner;
  store.remove('SafeOwner', id);

  let ownerChangeEntity = new SafeOwnerChange(safeAddress + '-remove-' + owner + '-' + txnHash);
  ownerChangeEntity.transaction = txnHash;
  ownerChangeEntity.timestamp = event.block.timestamp;
  ownerChangeEntity.safe = safeAddress;
  ownerChangeEntity.ownerRemoved = owner;
  ownerChangeEntity.save();
}

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let safeAddress = toChecksumAddress(event.transaction.to as Address);
  let txnHash = event.transaction.hash.toHex();

  log.debug('processing txn hash {} for safe {}', [txnHash, safeAddress]);
  let safe = Safe.load(safeAddress);
  if (safe == null) {
    log.warning(
      'Cannot process safe txn {}: Safe entity does not exist for safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the safe was created in.',
      [txnHash, safeAddress]
    );
    return;
  }
  makeEOATransactionForSafe(event, safe.id);

  let bytes = event.transaction.input.toHex();
  let methodHash = methodHashFromEncodedHex(bytes);

  if (methodHash == encodeMethodSignature(EXEC_TRANSACTION)) {
    let safeTxEntity = new SafeTransaction(txnHash + '-' + event.logIndex.toString());
    safeTxEntity.safe = safeAddress;
    safeTxEntity.transaction = txnHash;
    safeTxEntity.timestamp = event.block.timestamp;

    let decoded = decode(EXEC_TRANSACTION, bytes);
    safeTxEntity.to = toChecksumAddress(decoded[0].toAddress());
    safeTxEntity.value = decoded[1].toBigInt();
    safeTxEntity.data = decoded[2].toBytes();
    safeTxEntity.operation = decoded[3].toBigInt();
    safeTxEntity.safeTxGas = decoded[4].toBigInt();
    safeTxEntity.baseGas = decoded[5].toBigInt();
    safeTxEntity.gasPrice = decoded[6].toBigInt();
    safeTxEntity.gasToken = makeToken(decoded[7].toAddress());
    safeTxEntity.gasPayment = event.params.payment;
    safeTxEntity.refundReceiver = toChecksumAddress(decoded[8].toAddress());
    safeTxEntity.signatures = decoded[9].toBytes();

    log.debug(
      'SafeTransaction indexed in txn hash {}, id {}, safe: {}, timestamp {}, to: {}, value: {}, data: {}, operation: {}, safeTxGas {}, baseGas {}, gasPrice {}, gasToken: {}, refundReceiver: {}, signatures: {}',
      [
        txnHash,
        safeTxEntity.id,
        safeTxEntity.safe,
        safeTxEntity.timestamp.toString(),
        safeTxEntity.to,
        safeTxEntity.value.toString(),
        safeTxEntity.data.toHex(),
        safeTxEntity.operation.toString(),
        safeTxEntity.safeTxGas.toString(),
        safeTxEntity.baseGas.toString(),
        safeTxEntity.gasPrice.toString(),
        safeTxEntity.gasToken,
        safeTxEntity.refundReceiver,
        safeTxEntity.signatures.toHex(),
      ]
    );

    safeTxEntity.save();
  }
}
