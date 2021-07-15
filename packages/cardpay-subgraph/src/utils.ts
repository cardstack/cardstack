import { crypto, Address, ByteArray, ethereum, BigInt } from '@graphprotocol/graph-ts';
import { log } from '@graphprotocol/graph-ts';
import { ERC20 } from '../generated/Token/ERC20';
import { ERC20SymbolBytes } from '../generated/Token/ERC20SymbolBytes';
import { ERC20NameBytes } from '../generated/Token/ERC20NameBytes';
import { ZERO_ADDRESS } from '@protofire/subgraph-toolkit';
import { PrepaidCardManager } from '../generated/PrepaidCard/PrepaidCardManager';
import {
  EOATransaction,
  Transaction,
  MerchantRevenue,
  PrepaidCard,
  PrepaidCardPayment,
  Token,
  Safe,
  Account,
  MerchantSafe,
} from '../generated/schema';
import { GnosisSafe } from '../generated/Gnosis/GnosisSafe';
import { StaticToken } from './static-tokens';

export function makeToken(address: Address): string {
  let token = toChecksumAddress(address);
  if (Token.load(token) == null) {
    let tokenEntity = new Token(token);
    tokenEntity.symbol = fetchTokenSymbol(address);
    tokenEntity.name = fetchTokenName(address);
    tokenEntity.decimals = fetchTokenDecimals(address);
    tokenEntity.save();
  }
  return token;
}

export function makeTransaction(event: ethereum.Event): void {
  let txEntity = new Transaction(event.transaction.hash.toHex());
  txEntity.timestamp = event.block.timestamp;
  txEntity.blockNumber = event.block.number;
  txEntity.save();
}

export function makeEOATransaction(event: ethereum.Event, address: string): void {
  makeTransaction(event);
  let accountEntity = new Account(address);
  accountEntity.save();

  let txnHash = event.transaction.hash.toHex();
  let entity = new EOATransaction(txnHash + '-' + address);
  entity.transaction = txnHash;
  entity.account = address;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.save();
}

export function makeEOATransactionForSafe(event: ethereum.Event, safe: Safe): void {
  let safeContract = GnosisSafe.bind(Address.fromString(safe.id));
  let owners = safeContract.getOwners();
  for (let i = 0; i < owners.length; i++) {
    makeEOATransaction(event, toChecksumAddress(owners[i]));
  }
}

export function makeMerchantRevenue(merchantSafe: string, token: string): MerchantRevenue {
  let id = merchantSafe + '-' + token;
  let entity = MerchantRevenue.load(id);
  if (entity == null) {
    entity = new MerchantRevenue(merchantSafe + '-' + token);
    entity.token = token;
    entity.merchantSafe = merchantSafe;
    entity.lifetimeAccumulation = new BigInt(0);
    entity.unclaimedBalance = new BigInt(0);
    entity.save();
  }
  return entity as MerchantRevenue;
}

export function makePrepaidCardPayment(
  event: ethereum.Event,
  prepaidCardMgrAddress: Address,
  prepaidCard: string,
  txnHash: string,
  timestamp: BigInt,
  merchantSafe: string | null,
  issuingToken: string,
  issuingTokenAmount: BigInt,
  spendAmount: BigInt
): void {
  let prepaidCardEntity = PrepaidCard.load(prepaidCard);
  if (prepaidCardEntity != null) {
    let prepaidCardMgr = PrepaidCardManager.bind(prepaidCardMgrAddress);
    prepaidCardEntity.faceValue = prepaidCardMgr.faceValue(Address.fromString(prepaidCard));
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    prepaidCardEntity.spendBalance = prepaidCardEntity.spendBalance - spendAmount;
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    prepaidCardEntity.issuingTokenBalance = prepaidCardEntity.issuingTokenBalance - issuingTokenAmount;
    prepaidCardEntity.save();
  } else {
    log.warning(
      'Cannot process merchant payment txn {}: PrepaidCard entity does not exist for prepaid card {}. This is likely due to the subgraph having a startBlock that is higher than the block the prepaid card was created in.',
      [txnHash, prepaidCard]
    );
    return;
  }
  makeEOATransaction(event, prepaidCardEntity.owner);

  let paymentEntity = new PrepaidCardPayment(txnHash); // There will only ever be one merchant payment event per txn
  paymentEntity.transaction = txnHash;
  paymentEntity.timestamp = timestamp;
  paymentEntity.prepaidCard = prepaidCard;
  paymentEntity.prepaidCardOwner = prepaidCardEntity.owner;
  if (merchantSafe != null) {
    let merchantSafeEntity = MerchantSafe.load(merchantSafe);
    if (merchantSafeEntity != null) {
      paymentEntity.merchantSafe = merchantSafe;
      paymentEntity.merchant = merchantSafeEntity.merchant;
      makeEOATransaction(event, merchantSafeEntity.merchant);
    } else {
      log.warning(
        'Cannot process merchant payment txn {}: MerchantSafe entity does not exist for merchant safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the merchant safe was created in.',
        [txnHash, merchantSafe]
      );
      return;
    }
  }
  paymentEntity.issuingToken = issuingToken;
  paymentEntity.issuingTokenAmount = issuingTokenAmount;
  paymentEntity.spendAmount = spendAmount;
  paymentEntity.historicPrepaidCardIssuingTokenBalance = prepaidCardEntity.issuingTokenBalance;
  paymentEntity.historicPrepaidCardSpendBalance = prepaidCardEntity.spendBalance;
  paymentEntity.save();
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

function fetchTokenSymbol(tokenAddress: Address): string {
  let staticToken = StaticToken.fromAddress(tokenAddress);
  if (staticToken != null) {
    return (staticToken as StaticToken).symbol;
  }

  let contract = ERC20.bind(tokenAddress);
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress);

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown';
  let symbolResult = contract.try_symbol();
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol();
    if (!symbolResultBytes.reverted) {
      // for token that has no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        symbolValue = symbolResultBytes.value.toString();
      }
    }
  } else {
    symbolValue = symbolResult.value;
  }

  return symbolValue;
}

function fetchTokenName(tokenAddress: Address): string {
  let staticToken = StaticToken.fromAddress(tokenAddress);
  if (staticToken != null) {
    return (staticToken as StaticToken).name;
  }
  let contract = ERC20.bind(tokenAddress);
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress);

  // try types string and bytes32 for name
  let nameValue = 'unknown';
  let nameResult = contract.try_name();
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name();
    if (!nameResultBytes.reverted) {
      // for token that has no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString();
      }
    }
  } else {
    nameValue = nameResult.value;
  }

  return nameValue;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let staticToken = StaticToken.fromAddress(tokenAddress);
  if (staticToken != null) {
    return (staticToken as StaticToken).decimals;
  }
  let contract = ERC20.bind(tokenAddress);
  // try types uint8 for decimals
  let decimalValue = null;
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value;
  }
  return BigInt.fromI32(decimalValue as i32);
}

function isNullEthValue(value: string): boolean {
  return value == ZERO_ADDRESS;
}
