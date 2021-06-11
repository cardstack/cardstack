import { Address, BigInt, ethereum, Bytes, Result } from '@graphprotocol/graph-ts';
import { GnosisSafe, ExecutionSuccess, ExecTransactionCall } from '../../generated/templates/GnosisSafe/GnosisSafe';
import { toChecksumAddress, bytesFromHexString } from '../utils';
import { SafeTransaction, Token, Account } from '../../generated/schema';
import { log } from '@graphprotocol/graph-ts';
import { bytes } from '@protofire/subgraph-toolkit';

export function handleExecutionSuccess(event: ExecutionSuccess): void {
  let safeAddress = toChecksumAddress(event.transaction.to as Address);

  log.debug('=======> processing txn hash {} for safe {}', [event.transaction.hash.toHex(), safeAddress]);

  // ABI decoding is not working--doing this by hand (;﹏;)
  let bytes = event.transaction.input.toHex();
  let next = methodHash(bytes.slice(2));
  let method = next[0];
  bytes = next[1];
  assert(bytes.length % 64 == 0, 'gnosis execTransaction txn input has odd length');

  // TODO handle all the PrepaidCardMethod's functions too
  // 0x6a761202 -> execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)
  if (method == '0x6a761202') {
    let txEntity = new SafeTransaction(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
    txEntity.safe = safeAddress;
    // address      - to
    next = nextWordAsAddress(bytes);
    txEntity.to = next[0];
    bytes = next[1];

    // uint256      - value
    next = nextWord(bytes);
    txEntity.value = bigIntFromHexString(next[0]);
    bytes = next[1];

    // bytes offset - data
    bytes = nextWord(bytes)[1];

    // uint8        - operation
    next = nextWord(bytes);
    txEntity.operation = bigIntFromHexString(next[0]);
    bytes = next[1];

    // uint256      - safeTxGas
    next = nextWord(bytes);
    txEntity.safeTxGas = bigIntFromHexString(next[0]);
    bytes = next[1];

    // uint256      - baseGas
    next = nextWord(bytes);
    txEntity.baseGas = bigIntFromHexString(next[0]);
    bytes = next[1];

    // uint256      - gasPrice
    next = nextWord(bytes);
    txEntity.gasPrice = bigIntFromHexString(next[0]);
    bytes = next[1];

    // address      - gasToken
    next = nextWordAsAddress(bytes);
    txEntity.gasToken = next[0];
    bytes = next[1];

    // address      - refundReceiver
    next = nextWordAsAddress(bytes);
    txEntity.refundReceiver = next[0];
    bytes = next[1];

    // bytes offset - signature
    bytes = nextWord(bytes)[1];

    // bytes size   - data
    next = nextWord(bytes);
    let dataSize = downCast(next[0]) * 2;
    bytes = next[1];

    // right padded data blob
    let data = '';
    do {
      next = nextWord(bytes);
      data += next[0].slice(2);
      bytes = next[1];
    } while (data.length < dataSize);
    txEntity.data = bytesFromHexString('0x' + data.slice(0, dataSize));

    // bytes size   - signature
    next = nextWord(bytes);
    let signatureSize = downCast(next[0]) * 2;
    bytes = next[1];

    // right padded signature blob
    let signature = '';
    do {
      next = nextWord(bytes);
      signature += next[0].slice(2);
      bytes = next[1];
    } while (signature.length < signatureSize);
    txEntity.signatures = bytesFromHexString('0x' + signature.slice(0, signatureSize));

    log.debug(
      '=======> Gnosis.execTransaction called in txn hash {}, to: {}, safeTxGas {}, baseGas {}, gasPrice {}, dataSize: {}, data: {}',
      [
        event.transaction.hash.toHex(),
        txEntity.to,
        txEntity.safeTxGas.toString(),
        txEntity.baseGas.toString(),
        txEntity.gasPrice.toString(),
        dataSize.toString(),
        txEntity.data.toHex(),
      ]
    );

    txEntity.save();
  }
}

function methodHash(bytes: string): string[] {
  return ['0x' + bytes.slice(0, 8), bytes.slice(8)];
}
function nextWord(bytes: string): string[] {
  return ['0x' + bytes.slice(0, 64), bytes.slice(64)];
}
function nextWordAsAddress(bytes: string): string[] {
  let address = toChecksumAddress(Address.fromString('0x' + bytes.slice(24, 64)));
  return [address, bytes.slice(64)];
}

function bigIntFromHexString(hex: string): BigInt {
  return bytes.toUnsignedInt(bytesFromHexString(hex), true);
}

function downCast(bytes: string): i32 {
  let unpadded = removeZeroPadding(bytes.slice(2));
  return I32.parseInt(unpadded, 16);
}

function removeZeroPadding(bytes: string): string {
  while (bytes.startsWith('0')) {
    bytes = bytes.slice(1);
  }
  return bytes;
}
