import { Address } from '@graphprotocol/graph-ts';
import { ExecutionSuccess } from '../../generated/templates/GnosisSafe/GnosisSafe';
import { toChecksumAddress, makeTransaction, makeToken } from '../utils';
import { decode, encodeMethodSignature, methodHashFromEncodedHex } from '../abi';
import { SafeTransaction } from '../../generated/schema';
import { log } from '@graphprotocol/graph-ts';

const EXEC_TRANSACTION = 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)';

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let safeAddress = toChecksumAddress(event.transaction.to as Address);

  log.debug('processing txn hash {} for safe {}', [event.transaction.hash.toHex(), safeAddress]);

  let bytes = event.transaction.input.toHex();
  let methodHash = methodHashFromEncodedHex(bytes);

  // TODO handle all the PrepaidCardMethod's functions too
  if (methodHash == encodeMethodSignature(EXEC_TRANSACTION)) {
    makeTransaction(event);

    let safeTxEntity = new SafeTransaction(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
    safeTxEntity.safe = safeAddress;
    safeTxEntity.transaction = event.transaction.hash.toHex();
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
    safeTxEntity.refundReceiver = toChecksumAddress(decoded[8].toAddress());
    safeTxEntity.signatures = decoded[9].toBytes();

    log.debug(
      'SafeTransaction indexed in txn hash {}, id {}, safe: {}, timestamp {}, to: {}, value: {}, data: {}, operation: {}, safeTxGas {}, baseGas {}, gasPrice {}, gasToken: {}, refundReceiver: {}, signatures: {}',
      [
        event.transaction.hash.toHex(),
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
