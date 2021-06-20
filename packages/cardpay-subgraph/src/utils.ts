import { crypto, Address, ByteArray, ethereum, BigInt } from '@graphprotocol/graph-ts';
import { log } from '@graphprotocol/graph-ts';
import { Transaction, MerchantRevenue, PrepaidCard, PrepaidCardPayment } from '../generated/schema';

export function assertTransactionExists(event: ethereum.Event): void {
  let txEntity = new Transaction(event.transaction.hash.toHex());
  txEntity.timestamp = event.block.timestamp;
  txEntity.blockNumber = event.block.number;
  txEntity.save();
}

export function assertMerchantRevenueExists(merchantSafe: string, token: string): MerchantRevenue {
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

  let paymentEntity = new PrepaidCardPayment(txnHash); // There will only ever be one merchant payment event per txn
  paymentEntity.transaction = txnHash;
  paymentEntity.timestamp = timestamp;
  paymentEntity.prepaidCard = prepaidCard;
  if (merchantSafe != null) {
    paymentEntity.merchantSafe = merchantSafe;
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
