import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { RevenuePool } from '../../generated/RevenuePool/RevenuePool';
import {
  makeToken,
  makeEOATransaction,
  makeEOATransactionForSafe,
  toChecksumAddress,
  makeMerchantRevenue,
} from '../utils';
import {
  Safe,
  Account,
  TokenTransfer,
  TokenHolder,
  TokenHistory,
  MerchantRevenueEvent,
  MerchantDeposit,
  MerchantWithdraw,
  MerchantSafe,
} from '../../generated/schema';
import { ZERO_ADDRESS } from '@protofire/subgraph-toolkit';
import { Transfer as TransferEvent, ERC20 } from '../erc-20/ERC20';
import { addresses } from '../generated/addresses';

export function handleTransfer(event: TransferEvent): void {
  let txnHash = event.transaction.hash.toHex();
  let tokenAddress = makeToken(event.address);
  let relayFunder = addresses.get('relay') as string;

  let sender: TokenHolder | null = null;
  let receiver: TokenHolder | null = null;
  let to = toChecksumAddress(event.params.to);
  let from = toChecksumAddress(event.params.from);
  if (to != ZERO_ADDRESS) {
    receiver = makeTokenHolder(event.params.to, event.address);
    let receiverSafe = Safe.load(to);
    if (receiverSafe != null) {
      makeEOATransactionForSafe(event, receiverSafe.id);

      let revenuePoolAddress = addresses.get('revenuePool') as string;
      // token transfers from the revenue pool are actually claims, so don't include
      // those as MerchantDeposits
      if (MerchantSafe.load(to) != null && from != revenuePoolAddress) {
        let merchantDepositEntity = new MerchantDeposit(txnHash);
        merchantDepositEntity.timestamp = event.block.timestamp;
        merchantDepositEntity.blockNumber = event.block.number;
        merchantDepositEntity.transaction = txnHash;
        merchantDepositEntity.merchantSafe = to;
        merchantDepositEntity.token = tokenAddress;
        merchantDepositEntity.amount = event.params.value;
        merchantDepositEntity.from = from;
        merchantDepositEntity.save();

        let revenueEventEntity = makeMerchantRevenueEvent(event, to, tokenAddress);
        revenueEventEntity.merchantDeposit = txnHash;
        revenueEventEntity.save();
      }
    } else {
      makeEOATransaction(event, to);
    }
  }
  if (from != ZERO_ADDRESS) {
    sender = makeTokenHolder(event.params.from, event.address);
    let senderSafe = Safe.load(from);
    if (senderSafe != null) {
      makeEOATransactionForSafe(event, senderSafe.id);

      // don't count gas payments as merchant withdrawals
      if (MerchantSafe.load(from) != null && to != relayFunder) {
        let merchantWithdrawEntity = new MerchantWithdraw(txnHash);
        merchantWithdrawEntity.timestamp = event.block.timestamp;
        merchantWithdrawEntity.blockNumber = event.block.number;
        merchantWithdrawEntity.transaction = txnHash;
        merchantWithdrawEntity.merchantSafe = from;
        merchantWithdrawEntity.token = tokenAddress;
        merchantWithdrawEntity.amount = event.params.value;
        merchantWithdrawEntity.to = to;
        merchantWithdrawEntity.save();

        let revenueEventEntity = makeMerchantRevenueEvent(event, from, tokenAddress);
        revenueEventEntity.merchantWithdraw = txnHash;
        revenueEventEntity.save();
      }
    } else {
      makeEOATransaction(event, from);
    }
  }

  let transferEntity = new TokenTransfer(tokenAddress + '-' + txnHash + '-' + event.transactionLogIndex.toString());
  transferEntity.transaction = txnHash;
  transferEntity.timestamp = event.block.timestamp;
  transferEntity.blockNumber = event.block.number;
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
    historyEntity.blockNumber = event.block.number;
    historyEntity.sent = transferEntity.id;
    historyEntity.tokenHolder = sender.id;
    historyEntity.save();
  }

  if (receiver) {
    let historyEntity = new TokenHistory(transferEntity.id + '-' + receiver.id);
    historyEntity.transaction = txnHash;
    historyEntity.timestamp = event.block.timestamp;
    historyEntity.blockNumber = event.block.number;
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

function makeMerchantRevenueEvent(event: ethereum.Event, merchantSafe: string, token: string): MerchantRevenueEvent {
  let txnHash = event.transaction.hash.toHex();
  let revenuePoolAddress = addresses.get('revenuePool') as string;
  let revenueEntity = makeMerchantRevenue(merchantSafe, token);
  let revenuePool = RevenuePool.bind(Address.fromString(revenuePoolAddress));
  revenueEntity.unclaimedBalance = revenuePool.revenueBalance(
    Address.fromString(merchantSafe),
    Address.fromString(token)
  );
  revenueEntity.save();

  let revenueEventEntity = new MerchantRevenueEvent(txnHash);
  revenueEventEntity.transaction = txnHash;
  revenueEventEntity.timestamp = event.block.timestamp;
  revenueEventEntity.blockNumber = event.block.number;
  revenueEventEntity.merchantRevenue = revenueEntity.id;
  revenueEventEntity.historicLifetimeAccumulation = revenueEntity.lifetimeAccumulation;
  revenueEventEntity.historicUnclaimedBalance = revenueEntity.unclaimedBalance;
  return revenueEventEntity;
}
