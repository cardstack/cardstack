import { TransactionReceipt } from 'web3-core';

export interface SuccessfulTransactionReceipt extends TransactionReceipt {
  status: true;
}
