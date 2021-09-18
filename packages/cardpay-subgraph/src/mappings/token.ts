import { Address, BigInt } from '@graphprotocol/graph-ts';
import { makeToken, makeEOATransaction, makeEOATransactionForSafe, toChecksumAddress } from '../utils';
import { Safe, Account, TokenTransfer, TokenHolder, TokenHistory } from '../../generated/schema';
import { ZERO_ADDRESS } from '@protofire/subgraph-toolkit';
import { Transfer as TransferEvent, ERC20 } from '../erc-20/ERC20';
import { addresses } from '../generated/addresses';

export function handleTransfer(event: TransferEvent): void {
  let tokenAddress = makeToken(event.address);

  let sender: TokenHolder | null = null;
  let receiver: TokenHolder | null = null;
  let to = toChecksumAddress(event.params.to);
  let from = toChecksumAddress(event.params.from);
  if (to != ZERO_ADDRESS) {
    receiver = makeTokenHolder(event.params.to, event.address);
    let receiverSafe = Safe.load(to);
    if (receiverSafe != null) {
      makeEOATransactionForSafe(event, receiverSafe as Safe);
    } else {
      makeEOATransaction(event, to);
    }
  }
  if (from != ZERO_ADDRESS) {
    sender = makeTokenHolder(event.params.from, event.address);
    let senderSafe = Safe.load(from);
    if (senderSafe != null) {
      makeEOATransactionForSafe(event, senderSafe as Safe);
    } else {
      makeEOATransaction(event, from);
    }
  }
  let txnHash = event.transaction.hash.toHex();
  let relayFunder = addresses.get('relay') as string;

  let transferEntity = new TokenTransfer(tokenAddress + '-' + txnHash + '-' + event.transactionLogIndex.toString());
  transferEntity.transaction = txnHash;
  transferEntity.timestamp = event.block.timestamp;
  transferEntity.token = tokenAddress;
  transferEntity.amount = event.params.value;
  transferEntity.from = from != ZERO_ADDRESS ? from : null;
  transferEntity.to = to != ZERO_ADDRESS ? to : null;
  transferEntity.fromTokenHolder = sender != null ? sender.id : null;
  transferEntity.toTokenHolder = receiver != null ? receiver.id : null;
  transferEntity.isGasPayment = to == relayFunder;
  transferEntity.save();

  if (sender) {
    let historyEntity = new TokenHistory(transferEntity.id + '-' + sender.id);
    historyEntity.transaction = txnHash;
    historyEntity.timestamp = event.block.timestamp;
    historyEntity.sent = transferEntity.id;
    historyEntity.tokenHolder = sender.id;
    historyEntity.save();
  }

  if (receiver) {
    let historyEntity = new TokenHistory(transferEntity.id + '-' + receiver.id);
    historyEntity.transaction = txnHash;
    historyEntity.timestamp = event.block.timestamp;
    historyEntity.received = transferEntity.id;
    historyEntity.tokenHolder = receiver.id;
    historyEntity.save();
  }
}

function makeTokenHolder(holderAddress: Address, tokenAddress: Address): TokenHolder {
  let token = toChecksumAddress(tokenAddress);
  let holder = toChecksumAddress(holderAddress);
  let id = holder + '-' + token;
  let entity = TokenHolder.load(id);
  if (entity == null) {
    entity = new TokenHolder(id);
  }
  if (Safe.load(holder) == null) {
    entity.account = makeAccount(holderAddress);
  } else {
    entity.safe = holder;
  }
  entity.token = token;

  let contract = ERC20.bind(tokenAddress);

  let balanceResult = contract.try_balanceOf(holderAddress);
  if (balanceResult.reverted) {
    entity.balance = new BigInt(0);
  } else {
    entity.balance = balanceResult.value;
  }

  entity.save();
  return entity as TokenHolder;
}

function makeAccount(address: Address): string {
  let account = toChecksumAddress(address);
  let entity = new Account(account);
  entity.save();
  return account;
}
