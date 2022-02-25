import type { TransactionReceipt as MaybeSuccessfulTransactionReceipt } from 'web3-core';

export interface SuccessfulTransactionReceipt extends MaybeSuccessfulTransactionReceipt {
  status: true;
}
