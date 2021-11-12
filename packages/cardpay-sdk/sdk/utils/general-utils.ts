import Web3 from 'web3';
import { networks } from '../constants';
import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import BN from 'bn.js';
import { query as gqlQuery } from './graphql';

const POLL_INTERVAL = 500;

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
): Promise<TransactionReceipt> {
  let endTime = Number(new Date()) + duration;

  let transactionReceiptAsync = async function (
    txnHash: string,
    resolve: (value: TransactionReceipt | Promise<TransactionReceipt>) => void,
    reject: (reason?: any) => void
  ) {
    try {
      let receipt = await web3.eth.getTransactionReceipt(txnHash);
      if (receipt) {
        resolve(receipt);
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

export async function waitForSubgraphIndexWithTxnReceipt(
  web3: Web3,
  txnHash: string,
  duration = 60 * 10 * 1000
): Promise<TransactionReceipt> {
  let txnReceipt = await waitUntilTransactionMined(web3, txnHash, duration);
  await waitForSubgraphIndex(txnHash, web3, duration);
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
