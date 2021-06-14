import { crypto, Address, ByteArray, Bytes, BigInt, ethereum, log } from '@graphprotocol/graph-ts';
import { bytes } from '@protofire/subgraph-toolkit';
import { toHex } from './utils';

const WORD_SIZE = 64;

export function decode(typesStr: string, hex: string): Array<ethereum.Value> {
  log.debug('decoding abi type: {}, hex {}', [typesStr, hex]);
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }

  if (typesStr.endsWith(')') && !typesStr.startsWith('(')) {
    // the types looks like "someMethod(address,uint8,...)", we need to remove
    // the method hash from the hex, as the caller is indicating that we are
    // decoding a function call
    hex = hex.slice(8);
  }
  assert(hex.length % 64 == 0, 'hex for abi decoding has odd length ' + hex.length.toString() + ', hex: ' + hex);

  if (typesStr.indexOf('(') > -1) {
    typesStr = typesStr.slice(typesStr.indexOf('(') + 1, -1);
  }

  let types = typesStr.split(',');
  let result: Array<ethereum.Value> = [];

  for (let index = 0; index < types.length; index++) {
    let type = types[index];
    let pointer = index * WORD_SIZE;
    let word = wordAt(hex, pointer);
    let isArray = type.endsWith('[]');

    log.debug('decoding abi - word at {}: {}', [pointer.toString(), word]);

    if (!isArray) {
      if (type == 'address') {
        result.push(ethereum.Value.fromAddress(hexToAddress(word)));
      } else if (type.startsWith('uint')) {
        result.push(ethereum.Value.fromUnsignedBigInt(bigIntFromHex(word)));
      } else if (type == 'bool') {
        result.push(ethereum.Value.fromBoolean(hexToI32(word) == 1));
      } else if (type == 'bytes') {
        let offset = hexToI32(word) * 2;
        let length = hexToI32(hex.slice(offset, offset + WORD_SIZE)) * 2;
        result.push(ethereum.Value.fromBytes(bytesFromHex(hex.slice(offset + WORD_SIZE, offset + WORD_SIZE + length))));
      } else if (type == 'string') {
        let offset = hexToI32(word) * 2;
        let length = hexToI32(hex.slice(offset, offset + WORD_SIZE)) * 2;
        let utf8Hex = hex.slice(offset + WORD_SIZE, offset + WORD_SIZE + length);
        let str = '';
        for (let i = 0; i < utf8Hex.length; i += 2) {
          str += String.fromCharCode(hexToI32(utf8Hex.slice(i, i + 2)));
        }
        log.info('==========> decoding string - bytes: {} string: {}', [utf8Hex, str]);
        result.push(ethereum.Value.fromString(str));
      } else {
        assert(false, 'decoding ' + type + ' is not yet supported');
      }
    } else {
      let offset = hexToI32(word) * 2;
      let length = hexToI32(hex.slice(offset, offset + WORD_SIZE)) * 2;
      if (type.startsWith('uint')) {
        let array: Array<BigInt> = [];
        for (let i = 0; i < length; i++) {
          array.push(bigIntFromHex(wordAt(hex, offset + (i + 1) * WORD_SIZE)));
        }
        result.push(ethereum.Value.fromUnsignedBigIntArray(array));
      } else if (type.startsWith('address')) {
        let array: Array<Address> = [];
        for (let i = 0; i < length; i++) {
          array.push(hexToAddress(wordAt(hex, offset + (i + 1) * WORD_SIZE)));
        }
        result.push(ethereum.Value.fromAddressArray(array));
      } else if (type.startsWith('bool')) {
        let array: Array<boolean> = [];
        for (let i = 0; i < length; i++) {
          array.push(hexToI32(wordAt(hex, offset + (i + 1) * WORD_SIZE)) == 1);
        }
        result.push(ethereum.Value.fromBooleanArray(array));
      } else {
        assert(false, 'decoding ' + type + ' is not yet supported');
      }
    }
  }
  return result;
}

export function methodHashFromEncodedHex(hex: string): string {
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }
  return toHex(hex.slice(0, 8));
}

export function encodeMethodSignature(methodSignature: string): string {
  return crypto.keccak256(ByteArray.fromUTF8(methodSignature)).toHex().slice(0, 10);
}

function wordAt(hex: string, offset: i32): string {
  return hex.slice(offset, offset + WORD_SIZE);
}

function hexToAddress(hex: string): Address {
  return Address.fromString(toHex(hex.slice(24, 64)));
}

function bigIntFromHex(hex: string): BigInt {
  return bytes.toUnsignedInt(bytesFromHex(hex), true);
}

function bytesFromHex(hex: string): Bytes {
  if (!hex.startsWith('0x')) {
    hex = toHex(hex);
  }
  return Bytes.fromHexString(hex) as Bytes;
}

function hexToI32(hex: string): i32 {
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }
  let unpadded = removeZeroPadding(hex);
  return I32.parseInt(unpadded, 16);
}

function removeZeroPadding(hex: string): string {
  while (hex.startsWith('0')) {
    hex = hex.slice(1);
  }
  return hex;
}
