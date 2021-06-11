// we aren't ready to use this yet--but it works well. we'll uncomment this as
// soon as we are ready to start the token indexing. Leaving it uncommented out
// breaks the tsc build because of the missing codegen since the subgraph is
// commented out as well.

/*
import { assertTransactionExists, toChecksumAddress } from '../utils';
import { Transfer as TransferEvent } from '../../generated/Token/ERC677Token';
import { Token, Safe, Account, TokenTransfer } from '../../generated/schema';

export function handleTransfer(event: TransferEvent): void {
  assertTransactionExists(event);

  let from = toChecksumAddress(event.params.from);
  let to = toChecksumAddress(event.params.to);
  let tokenAddress = toChecksumAddress(event.address);

  let tokenEntity = new Token(tokenAddress);
  tokenEntity.save();

  let transferEntity = new TokenTransfer(
    tokenAddress + '-' + event.transaction.hash.toHex() + '-' + event.transactionLogIndex.toString()
  );
  if (Safe.load(from) == null) {
    let account = new Account(from);
    account.save();
    transferEntity.from = from;
  } else {
    transferEntity.fromSafe = from;
  }

  if (Safe.load(to) == null) {
    let account = new Account(to);
    account.save();
    transferEntity.to = to;
  } else {
    transferEntity.toSafe = to;
  }

  transferEntity.transaction = event.transaction.hash.toHex();
  transferEntity.token = tokenAddress;
  transferEntity.amount = event.params.value;
  transferEntity.timestamp = event.block.timestamp;
  transferEntity.save();
}
*/
