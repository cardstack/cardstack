import { crypto, Address, ByteArray, ethereum } from '@graphprotocol/graph-ts';
import { Transaction } from '../generated/schema';

export function assertTransactionExists(event: ethereum.Event): void {
  let txEntity = new Transaction(event.transaction.hash.toHex());
  txEntity.timestamp = event.block.timestamp;
  txEntity.blockNumber = event.block.number;
  txEntity.save();
}

export function toChecksumAddress(address: Address): string {
  let lowerCaseAddress = address.toHex().slice(2);
  let hash = crypto
    .keccak256(ByteArray.fromUTF8(address.toHex().slice(2)))
    .toHex()
    .slice(2);
  let result = '';

  for (let i = 0; i < lowerCaseAddress.length; i++) {
    if (parseInt(hash.charAt(i), 16) >= 8) {
      result += toUpper(lowerCaseAddress.charAt(i));
    } else {
      result += lowerCaseAddress.charAt(i);
    }
  }

  return toHex(result);
}

export function toHex(bytes: string): string {
  return '0x' + bytes;
}

function toUpper(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    // only operate on lowercase 'a' thru lower case 'z'
    if (charCode >= 97 && charCode <= 122) {
      result += String.fromCharCode(charCode - 32);
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}
