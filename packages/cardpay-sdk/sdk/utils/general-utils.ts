import type { SuccessfulTransactionReceipt } from './successful-transaction-receipt';

import Web3 from 'web3';
import { networks } from '../constants';
import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import BN from 'bn.js';
import { query as gqlQuery } from './graphql';
import { AbiItem } from 'web3-utils';
import { Operation } from './safe-utils';

const POLL_INTERVAL = 500;

const receiptCache = new Map<string, SuccessfulTransactionReceipt>();

export interface Transaction {
  to: string;
  value: string;
  data: string;
  operation: Operation;
}
export interface TransactionOptions {
  nonce?: BN;
  onNonce?: (nonce: BN) => void;
  onTxnHash?: (txnHash: string) => unknown;
}

export async function networkName(web3: Web3): Promise<string> {
  let id = await web3.eth.net.getId();
  let name = networks[id];
  if (!name) {
    throw new Error(`Don't know what name the network id ${id} is`);
  }
  return name;
}

// Used to prevent block mismatch errors in infura (layer 1)
// https://github.com/88mphapp/ng88mph-frontend/issues/55#issuecomment-940414832
export async function safeContractCall(
  web3: Web3,
  contract: Contract,
  method: string,
  ...args: any[]
): Promise<unknown> {
  if (['kovan', 'mainnet'].includes(await networkName(web3))) {
    let previousBlockNumber = (await web3.eth.getBlockNumber()) - 1;
    return await contract.methods[method](...args).call({}, previousBlockNumber);
  }
  return await contract.methods[method](...args).call();
}

export function waitUntilTransactionMined(
  web3: Web3,
  txnHash: string,
  duration = 60 * 10 * 1000
): Promise<SuccessfulTransactionReceipt> {
  let endTime = Number(new Date()) + duration;

  let transactionReceiptAsync = async function (
    txnHash: string,
    resolve: (value: SuccessfulTransactionReceipt | Promise<SuccessfulTransactionReceipt>) => void,
    reject: (reason?: any) => void
  ) {
    if (receiptCache.has(txnHash)) {
      resolve(receiptCache.get(txnHash)!);
      return;
    }

    try {
      let receipt = await web3.eth.getTransactionReceipt(txnHash);
      if (receipt?.status) {
        let successfulReceipt = receipt as SuccessfulTransactionReceipt;
        receiptCache.set(txnHash, successfulReceipt);
        resolve(successfulReceipt);
      } else if (receipt?.status === false) {
        throw new Error(`Transaction with hash "${txnHash}" was reverted`);
      } else if (Number(new Date()) > endTime) {
        throw new Error(
          `Transaction took too long to complete, waited ${duration / 1000} seconds. txn hash: ${txnHash}`
        );
      } else {
        setTimeout(function () {
          return transactionReceiptAsync(txnHash, resolve, reject);
        }, POLL_INTERVAL);
      }
    } catch (e) {
      reject(e);
    }
  };

  return new Promise(function (resolve, reject) {
    transactionReceiptAsync(txnHash, resolve, reject);
  });
}

export function waitUntilBlock(web3: Web3, blockNumber: number, duration = 60 * 10 * 1000): Promise<void> {
  let endTime = Number(new Date()) + duration;

  let desiredBlockAsync = async function (blockNumber: number, resolve: () => void, reject: (reason?: any) => void) {
    try {
      let currentBlockNumber = await web3.eth.getBlockNumber();
      if (currentBlockNumber >= blockNumber) {
        resolve();
      } else if (Number(new Date()) > endTime) {
        throw new Error(
          `Desired block number did not appear after waiting ${
            duration / 1000
          } seconds. Current block number is: ${currentBlockNumber}`
        );
      } else {
        setTimeout(function () {
          return desiredBlockAsync(blockNumber, resolve, reject);
        }, POLL_INTERVAL);
      }
    } catch (e) {
      reject(e);
    }
  };

  return new Promise(function (resolve, reject) {
    desiredBlockAsync(blockNumber, resolve, reject);
  });
}

export function waitForEvent(contract: Contract, eventName: string, opts: PastEventOptions): Promise<EventData> {
  let eventDataAsync = async function (
    resolve: (value: EventData | Promise<EventData>) => void,
    reject: (reason?: any) => void
  ) {
    try {
      let events = await contract.getPastEvents(eventName, opts);
      if (!events.length) {
        setTimeout(function () {
          eventDataAsync(resolve, reject);
        }, POLL_INTERVAL);
      } else {
        resolve(events[events.length - 1]);
      }
    } catch (e) {
      reject(e);
    }
  };

  return new Promise(function (resolve, reject) {
    eventDataAsync(resolve, reject);
  });
}

const transactionQuery = `
  query ($txnHash: ID!) {
    transaction(id:$txnHash) {
    id
    }
  }
`;
interface TransactionQuerySubgraph {
  data: {
    transaction: {
      id: string;
    } | null;
  };
}

export async function waitForSubgraphIndex(txnHash: string, network: string, duration?: number): Promise<void>;
export async function waitForSubgraphIndex(txnHash: string, web3: Web3, duration?: number): Promise<void>;
export async function waitForSubgraphIndex(
  txnHash: string,
  networkOrWeb3: string | Web3,
  duration = 60 * 10 * 1000
): Promise<void> {
  let network: string;
  if (typeof networkOrWeb3 === 'string') {
    network = networkOrWeb3;
  } else {
    network = await networkName(networkOrWeb3);
  }

  let start = Date.now();
  let queryResults: TransactionQuerySubgraph | undefined;
  do {
    if (queryResults) {
      await new Promise<void>((res) => setTimeout(() => res(), POLL_INTERVAL));
    }
    queryResults = await gqlQuery(network, transactionQuery, { txnHash });
  } while (queryResults.data.transaction == null && Date.now() < start + duration);

  if (!queryResults.data.transaction) {
    throw new Error(`Timed out waiting for txnHash to be indexed ${txnHash}`);
  }

  return;
}

async function waitForSafeNonceAdvance(
  web3: Web3,
  safeAddress: string,
  currentNonce: number,
  duration = 60 * 10 * 1000
): Promise<void> {
  let nonce: number,
    hasTried = false,
    start = Date.now(),
    safe = new web3.eth.Contract(GnosisSafeABI as AbiItem[], safeAddress);

  do {
    if (hasTried) {
      await new Promise<void>((res) => setTimeout(() => res, POLL_INTERVAL));
    }
    nonce = new BN(await safe.methods.nonce().call()).toNumber();
    hasTried = true;
  } while (nonce < currentNonce + 1 && Date.now() < start + duration);

  if (nonce < currentNonce + 1) {
    let msg = `Timed out waiting for safe ${safeAddress} nonce to advance to ${currentNonce + 1}`;
    console.error(msg);
    throw new Error(msg);
  }
}

export async function waitForTransactionConsistency(
  web3: Web3,
  txnHash: string,
  safeAddress: string,
  currentNonce: number,
  duration?: number
): Promise<SuccessfulTransactionReceipt>;
export async function waitForTransactionConsistency(
  web3: Web3,
  txnHash: string,
  safeAddress: string,
  currentNonce: BN,
  duration?: number
): Promise<SuccessfulTransactionReceipt>;
export async function waitForTransactionConsistency(
  web3: Web3,
  txnHash: string,
  duration?: number
): Promise<SuccessfulTransactionReceipt>;
export async function waitForTransactionConsistency(
  web3: Web3,
  txnHash: string,
  safeAddressOrDuration: string | number | undefined,
  currentNonce?: number | BN | undefined,
  duration = 60 * 10 * 1000
): Promise<SuccessfulTransactionReceipt> {
  let safeAddress: string | undefined;
  if (typeof safeAddressOrDuration === 'string') {
    safeAddress = safeAddressOrDuration;
  } else if (typeof safeAddressOrDuration === 'number') {
    duration = safeAddressOrDuration;
  }

  let nonce: number | undefined;
  if (currentNonce != null && typeof currentNonce !== 'number') {
    nonce = currentNonce?.toNumber();
  } else if (currentNonce != null) {
    nonce = currentNonce;
  }

  let start = Date.now();
  console.log(
    `  waiting for txn consistency for txn=${txnHash}${safeAddress ? ', safe=' + safeAddress : ''}${
      nonce != null ? ', nonce=' + nonce : ''
    }`
  );
  let txnReceipt = await waitUntilTransactionMined(web3, txnHash, duration);
  console.log(`  txn mined for txn=${txnHash} in ${Date.now() - start}ms`);
  start = Date.now();
  await waitForSubgraphIndex(txnHash, web3, duration);
  console.log(`  subgraph indexed for txn=${txnHash} in ${Date.now() - start}ms`);
  start = Date.now();

  if (safeAddress != null && nonce != null) {
    await waitForSafeNonceAdvance(web3, safeAddress, nonce, 10 * 1000);
    console.log(`  nonce advanced for txn=${txnHash} safe=${safeAddress} in ${Date.now() - start}ms`);
  }
  return txnReceipt;
}

// because BN does not handle floating point, and the numbers from ethereum
// might be too large for JS to handle, we'll use string manipulation to move
// the decimal point. After this operation, the number should be safely in JS's
// territory.
export function safeFloatConvert(rawAmount: BN, decimals: number): number {
  let amountStr = rawAmount.toString().padStart(decimals, '0');
  return Number(`${amountStr.slice(0, -1 * decimals)}.${amountStr.slice(-1 * decimals)}`);
}

export function isTransactionHash(candidate: string): boolean {
  return !!candidate.match(/^0x[0-9a-f]{64}$/);
}

export async function sendTransaction(web3: Web3, transaction: Transaction): Promise<string> {
  /* eslint-disable no-async-promise-executor */
  let txHash: string = await new Promise(async (resolve, reject) => {
    web3.eth
      .sendTransaction({
        ...transaction,
        from: (await web3.eth.getAccounts())[0],
      })
      .once('transactionHash', (transactionHash) => resolve(transactionHash))
      .catch((err) => reject(err));
  });

  return txHash;
}

export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

