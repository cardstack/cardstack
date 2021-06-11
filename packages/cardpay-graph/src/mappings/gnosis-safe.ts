import { Address } from '@graphprotocol/graph-ts';
import { ExecutionSuccess } from '../../generated/templates/GnosisSafe/GnosisSafe';
import { toChecksumAddress, decodeAbi, getMethodHash, methodHashFromHex } from '../utils';
import { SafeTransaction, Token, Account } from '../../generated/schema';
import { log } from '@graphprotocol/graph-ts';

const EXEC_TRANSACTION = 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)';

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let safeAddress = toChecksumAddress(event.transaction.to as Address);

  log.debug('processing txn hash {} for safe {}', [event.transaction.hash.toHex(), safeAddress]);

  // ABI decoding is not working--doing this by hand (;﹏;)
  let bytes = event.transaction.input.toHex();
  let method = methodHashFromHex(bytes);

  // TODO handle all the PrepaidCardMethod's functions too
  if (method == getMethodHash(EXEC_TRANSACTION)) {
    let txEntity = new SafeTransaction(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
    txEntity.safe = safeAddress;
    txEntity.timestamp = event.block.timestamp;

    let decoded = decodeAbi(EXEC_TRANSACTION, bytes);
    txEntity.to = toChecksumAddress(decoded[0].toAddress());
    txEntity.value = decoded[1].toBigInt();
    txEntity.data = decoded[2].toBytes();
    txEntity.operation = decoded[3].toBigInt();
    txEntity.safeTxGas = decoded[4].toBigInt();
    txEntity.baseGas = decoded[5].toBigInt();
    txEntity.gasPrice = decoded[6].toBigInt();
    txEntity.gasToken = toChecksumAddress(decoded[7].toAddress());
    txEntity.refundReceiver = toChecksumAddress(decoded[8].toAddress());
    txEntity.signatures = decoded[9].toBytes();

    log.info(
      'SafeTransaction indexed in txn hash {}, id {}, safe: {}, timestamp {}, to: {}, value: {}, data: {}, operation: {}, safeTxGas {}, baseGas {}, gasPrice {}, gasToken: {}, refundReceiver: {}, signatures: {}',
      [
        event.transaction.hash.toHex(),
        txEntity.id,
        txEntity.safe,
        txEntity.timestamp.toString(),
        txEntity.to,
        txEntity.value.toString(),
        txEntity.data.toHex(),
        txEntity.operation.toString(),
        txEntity.safeTxGas.toString(),
        txEntity.baseGas.toString(),
        txEntity.gasPrice.toString(),
        txEntity.gasToken,
        txEntity.refundReceiver,
        txEntity.signatures.toHex(),
      ]
    );

    txEntity.save();
  }
}
