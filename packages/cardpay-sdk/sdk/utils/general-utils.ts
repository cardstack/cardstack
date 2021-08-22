import Web3 from 'web3';
import { networks } from '../constants';
import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import BN from 'bn.js';

const POLL_INTERVAL = 500;

export async function networkName(web3: Web3): Promise<string> {
  let id = await web3.eth.net.getId();
  let name = networks[id];
  if (!name) {
    throw new Error(`Don't know what name the network id ${id} is`);
  }
  return name;
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

// because BN does not handle floating point, and the numbers from ethereum
// might be too large for JS to handle, we'll use string manipulation to move
// the decimal point. After this operation, the number should be safely in JS's
// territory.
export function safeFloatConvert(rawAmount: BN, decimals: number): number {
  let amountStr = rawAmount.toString().padStart(decimals, '0');
  return Number(`${amountStr.slice(0, -1 * decimals)}.${amountStr.slice(-1 * decimals)}`);
}
