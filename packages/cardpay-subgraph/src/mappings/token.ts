import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { makeToken, makeEOATransaction, makeEOATransactionForSafe, toChecksumAddress } from '../utils';
import { Safe, Account, TokenTransfer, TokenHolder, TokenHistory } from '../../generated/schema';
import { ZERO_ADDRESS } from '@protofire/subgraph-toolkit';

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
  let transferEntity = new TokenTransfer(tokenAddress + '-' + txnHash + '-' + event.transactionLogIndex.toString());
  transferEntity.transaction = txnHash;
  transferEntity.timestamp = event.block.timestamp;
  transferEntity.token = tokenAddress;
  transferEntity.amount = event.params.value;
  transferEntity.from = from != ZERO_ADDRESS ? from : null;
  transferEntity.to = to != ZERO_ADDRESS ? to : null;
  transferEntity.fromTokenHolder = sender != null ? sender.id : null;
  transferEntity.toTokenHolder = receiver != null ? receiver.id : null;
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

// Taken from generated ERC-20 ABI. We are replicating this here to avoid having
// token specific data source generated modules, since ERC-20's are all the same
// regardless of token
class TransferEvent extends ethereum.Event {
  get params(): Transfer__Params {
    return new Transfer__Params(this);
  }
}

class Transfer__Params {
  _event: TransferEvent;

  constructor(event: TransferEvent) {
    this._event = event;
  }

  get from(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get to(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get value(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }
}

export class ERC20 extends ethereum.SmartContract {
  static bind(address: Address): ERC20 {
    return new ERC20('ERC20', address);
  }

  name(): string {
    let result = super.call('name', 'name():(string)', []);

    return result[0].toString();
  }

  try_name(): ethereum.CallResult<string> {
    let result = super.tryCall('name', 'name():(string)', []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toString());
  }

  approve(_spender: Address, _value: BigInt): boolean {
    let result = super.call('approve', 'approve(address,uint256):(bool)', [
      ethereum.Value.fromAddress(_spender),
      ethereum.Value.fromUnsignedBigInt(_value),
    ]);

    return result[0].toBoolean();
  }

  try_approve(_spender: Address, _value: BigInt): ethereum.CallResult<boolean> {
    let result = super.tryCall('approve', 'approve(address,uint256):(bool)', [
      ethereum.Value.fromAddress(_spender),
      ethereum.Value.fromUnsignedBigInt(_value),
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBoolean());
  }

  totalSupply(): BigInt {
    let result = super.call('totalSupply', 'totalSupply():(uint256)', []);

    return result[0].toBigInt();
  }

  try_totalSupply(): ethereum.CallResult<BigInt> {
    let result = super.tryCall('totalSupply', 'totalSupply():(uint256)', []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  transferFrom(_from: Address, _to: Address, _value: BigInt): boolean {
    let result = super.call('transferFrom', 'transferFrom(address,address,uint256):(bool)', [
      ethereum.Value.fromAddress(_from),
      ethereum.Value.fromAddress(_to),
      ethereum.Value.fromUnsignedBigInt(_value),
    ]);

    return result[0].toBoolean();
  }

  try_transferFrom(_from: Address, _to: Address, _value: BigInt): ethereum.CallResult<boolean> {
    let result = super.tryCall('transferFrom', 'transferFrom(address,address,uint256):(bool)', [
      ethereum.Value.fromAddress(_from),
      ethereum.Value.fromAddress(_to),
      ethereum.Value.fromUnsignedBigInt(_value),
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBoolean());
  }

  decimals(): i32 {
    let result = super.call('decimals', 'decimals():(uint8)', []);

    return result[0].toI32();
  }

  try_decimals(): ethereum.CallResult<i32> {
    let result = super.tryCall('decimals', 'decimals():(uint8)', []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toI32());
  }

  balanceOf(_owner: Address): BigInt {
    let result = super.call('balanceOf', 'balanceOf(address):(uint256)', [ethereum.Value.fromAddress(_owner)]);

    return result[0].toBigInt();
  }

  try_balanceOf(_owner: Address): ethereum.CallResult<BigInt> {
    let result = super.tryCall('balanceOf', 'balanceOf(address):(uint256)', [ethereum.Value.fromAddress(_owner)]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }

  symbol(): string {
    let result = super.call('symbol', 'symbol():(string)', []);

    return result[0].toString();
  }

  try_symbol(): ethereum.CallResult<string> {
    let result = super.tryCall('symbol', 'symbol():(string)', []);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toString());
  }

  transfer(_to: Address, _value: BigInt): boolean {
    let result = super.call('transfer', 'transfer(address,uint256):(bool)', [
      ethereum.Value.fromAddress(_to),
      ethereum.Value.fromUnsignedBigInt(_value),
    ]);

    return result[0].toBoolean();
  }

  try_transfer(_to: Address, _value: BigInt): ethereum.CallResult<boolean> {
    let result = super.tryCall('transfer', 'transfer(address,uint256):(bool)', [
      ethereum.Value.fromAddress(_to),
      ethereum.Value.fromUnsignedBigInt(_value),
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBoolean());
  }

  allowance(_owner: Address, _spender: Address): BigInt {
    let result = super.call('allowance', 'allowance(address,address):(uint256)', [
      ethereum.Value.fromAddress(_owner),
      ethereum.Value.fromAddress(_spender),
    ]);

    return result[0].toBigInt();
  }

  try_allowance(_owner: Address, _spender: Address): ethereum.CallResult<BigInt> {
    let result = super.tryCall('allowance', 'allowance(address,address):(uint256)', [
      ethereum.Value.fromAddress(_owner),
      ethereum.Value.fromAddress(_spender),
    ]);
    if (result.reverted) {
      return new ethereum.CallResult();
    }
    let value = result.value;
    return ethereum.CallResult.fromValue(value[0].toBigInt());
  }
}
