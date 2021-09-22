import { crypto, Address, ByteArray, ethereum, BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { log } from '@graphprotocol/graph-ts';
import { ERC20 } from './erc-20/ERC20';
import { ERC20SymbolBytes } from './erc-20/ERC20SymbolBytes';
import { ERC20NameBytes } from './erc-20/ERC20NameBytes';
import { ZERO_ADDRESS } from '@protofire/subgraph-toolkit';
import { PrepaidCardManager } from '../generated/PrepaidCard/PrepaidCardManager';
import { Exchange } from '../generated/PrepaidCard/Exchange';
import {
  EOATransaction,
  Transaction,
  MerchantRevenue,
  PrepaidCard,
  PrepaidCardPayment,
  RevenueEarningsByDay,
  Token,
  Account,
  MerchantSafe,
} from '../generated/schema';
import { GnosisSafe } from '../generated/Gnosis/GnosisSafe';
import { StaticToken } from './static-tokens';
import { addresses } from './generated/addresses';
import { dayMonthYearFromEventTimestamp } from './dates';

export let protocolVersions = new Map<string, i32>();

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
  txEntity.gasUsed = event.transaction.gasUsed;
  txEntity.save();
}

export function makeEOATransaction(event: ethereum.Event, address: string, safe: string | null = null): void {
  makeTransaction(event);
  let accountEntity = new Account(address);
  accountEntity.save();

  let txnHash = event.transaction.hash.toHex();
  let entity = new EOATransaction(txnHash + '-' + address);
  entity.transaction = txnHash;
  entity.account = address;
  entity.safe = safe;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.save();
}

export function makeEOATransactionForSafe(event: ethereum.Event, safe: string): void {
  let safeContract = GnosisSafe.bind(Address.fromString(safe));
  let owners = safeContract.getOwners();
  for (let i = 0; i < owners.length; i++) {
    makeEOATransaction(event, toChecksumAddress(owners[i]), safe);
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
  prepaidCard: string,
  merchantSafe: string | null,
  issuingToken: string,
  issuingTokenAmount: BigInt,
  spendAmount: BigInt | null
): void {
  let txnHash = event.transaction.hash.toHex();
  let timestamp = event.block.timestamp;
  let prepaidCardEntity = PrepaidCard.load(prepaidCard);
  let faceValue = getPrepaidCardFaceValue(prepaidCard);
  if (prepaidCardEntity != null) {
    let token = ERC20.bind(Address.fromString(issuingToken));
    prepaidCardEntity.faceValue = faceValue;
    prepaidCardEntity.issuingTokenBalance = token.balanceOf(Address.fromString(prepaidCard));
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
      makeEOATransactionForSafe(event, merchantSafe);
    } else {
      log.warning(
        'Cannot process merchant payment txn {}: MerchantSafe entity does not exist for merchant safe address {}. This is likely due to the subgraph having a startBlock that is higher than the block the merchant safe was created in.',
        [txnHash, merchantSafe]
      );
      return;
    }
  }
  if (spendAmount == null) {
    spendAmount = convertToSpend(Address.fromString(issuingToken), issuingTokenAmount);
  }
  paymentEntity.issuingToken = issuingToken;
  paymentEntity.issuingTokenAmount = issuingTokenAmount;
  paymentEntity.issuingTokenUSDPrice = usdExchangeRate(Address.fromString(issuingToken));
  paymentEntity.spendAmount = spendAmount as BigInt;
  paymentEntity.historicPrepaidCardIssuingTokenBalance = prepaidCardEntity.issuingTokenBalance;
  paymentEntity.historicPrepaidCardFaceValue = faceValue;
  paymentEntity.save();

  if (merchantSafe != null) {
    let revenueEntity = makeMerchantRevenue(merchantSafe, issuingToken);

    let date = dayMonthYearFromEventTimestamp(event);
    let dateStr = date.year.toString() + '-' + date.month.toString() + '-' + date.day.toString();
    let earningsByDayId = merchantSafe + issuingToken + dateStr;
    let earningsByDayEntity = RevenueEarningsByDay.load(earningsByDayId);
    if (earningsByDayEntity == null) {
      earningsByDayEntity = new RevenueEarningsByDay(earningsByDayId);
      earningsByDayEntity.date = dateStr;
      earningsByDayEntity.merchantRevenue = revenueEntity.id;
      earningsByDayEntity.spendAccumulation = new BigInt(0);
      earningsByDayEntity.issuingTokenAccumulation = new BigInt(0);
    }
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    earningsByDayEntity.spendAccumulation = earningsByDayEntity.spendAccumulation + (spendAmount as BigInt);
    // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
    earningsByDayEntity.issuingTokenAccumulation = earningsByDayEntity.issuingTokenAccumulation + issuingTokenAmount;
    earningsByDayEntity.save();
  }
}

export function getPrepaidCardFaceValue(prepaidCard: string): BigInt {
  let prepaidCardMgr = PrepaidCardManager.bind(Address.fromString(addresses.get('prepaidCardManager') as string));
  let cardDetails = prepaidCardMgr.cardDetails(Address.fromString(prepaidCard));
  let issuingToken = cardDetails.value1;
  let tokenContract = ERC20.bind(issuingToken);
  let issuingTokenBalance = tokenContract.balanceOf(Address.fromString(prepaidCard));
  let faceValue = convertToSpend(issuingToken, issuingTokenBalance);
  return faceValue;
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

function usdExchangeRate(issuingToken: Address): BigDecimal {
  let exchange = getExchange();
  let exchangeInfo = exchange.exchangeRateOf(issuingToken);
  let rawRate = BigDecimal.fromString(exchangeInfo.value0.toString());
  // @ts-ignore this is legit AssemblyScript that tsc doesn't understand
  return rawRate / BigDecimal.fromString('100000000');
}

function convertToSpend(issuingToken: Address, issuingTokenAmount: BigInt): BigInt {
  let exchange = getExchange();
  return exchange.convertToSpend(issuingToken, issuingTokenAmount);
}

function getExchange(): Exchange {
  let prepaidCardMgr = PrepaidCardManager.bind(Address.fromString(addresses.get('prepaidCardManager') as string));
  let exchangeAddress = prepaidCardMgr.exchangeAddress();
  return Exchange.bind(exchangeAddress);
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

// Return 1 if a > b
// Return -1 if a < b
// Return 0 if a == b
export function compareSemver(a: string, b: string): i32 {
  if (a === b) {
    return 0;
  }
  let aComponents = a.split('.');
  let bComponents = b.split('.');
  let len = Math.min(aComponents.length, bComponents.length);
  for (let i = 0; i < len; i++) {
    // A bigger than B
    if (I32.parseInt(aComponents[i]) > I32.parseInt(bComponents[i])) {
      return 1;
    }
    // B bigger than A
    if (I32.parseInt(aComponents[i]) < I32.parseInt(bComponents[i])) {
      return -1;
    }
  }
  // If one's a prefix of the other, the longer one is greater.
  if (aComponents.length > bComponents.length) {
    return 1;
  }
  if (aComponents.length < bComponents.length) {
    return -1;
  }
  // Otherwise they are the same.
  return 0;
}

function isNullEthValue(value: string): boolean {
  return value == ZERO_ADDRESS;
}
