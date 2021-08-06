/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { Log } from 'web3-core';
import { getConstant } from '../constants';
import { Signature } from './signing-utils';

export interface EventABI {
  topic: string;
  abis: { type: string; name: string }[];
}

export interface Estimate {
  safeTxGas: string;
  baseGas: string;
  dataGas: string;
  operationalGas: string;
  gasPrice: string;
  lastUsedNonce: number | undefined;
  gasToken: string;
  refundReceiver: string;
}
export interface SendPayload extends Estimate {
  data: any;
}

export interface RelayTransaction {
  to: string;
  ethereumTx: {
    txHash: string;
    to: string;
    data: string;
    blockNumber: string;
    blockTimestamp: string;
    created: string;
    modified: string;
    gasUsed: string;
    status: number;
    transactionIndex: number;
    gas: string;
    gasPrice: string;
    nonce: string;
    value: string;
    from: string;
  };
}
export interface GnosisExecTx extends RelayTransaction {
  value: number;
  nonce: number;
  data: string;
  timestamp: string;
  operation: string;
  safeTxGas: number;
  dataGas: number;
  gasPrice: number;
  gasToken: string;
  refundReceiver: string;
  safeTxHash: string;
  txHash: string;
  transactionHash: string;
}

export async function gasEstimate(
  web3: Web3,
  from: string,
  to: string,
  value: string,
  data: string,
  operation: number,
  gasToken: string
): Promise<Estimate> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  let url = `${relayServiceURL}/v2/safes/${from}/transactions/estimate/`;
  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      Accept: 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
    },
    body: JSON.stringify({
      to,
      value,
      data,
      operation,
      gasToken,
    }),
  };
  let response = await fetch(url, options);
  if (!response?.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

export async function getSendPayload(
  web3: Web3,
  prepaidCardAddress: string,
  spendAmount: number,
  rate: string,
  action: string,
  data: string
): Promise<SendPayload> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  let url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/send/get-params/`;
  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
      Accept: 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
    },
    body: JSON.stringify({
      payment: spendAmount,
      rate,
      action,
      data,
    }),
  };
  let response = await fetch(url, options);
  if (!response?.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

export async function executeTransaction(
  web3: Web3,
  from: string,
  to: string,
  value: number,
  data: any,
  operation: number,
  safeTxGas: string,
  dataGas: string,
  gasPrice: string,
  nonce: BN,
  signatures: any,
  gasToken: string,
  refundReceiver: string
): Promise<GnosisExecTx> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  const url = `${relayServiceURL}/v1/safes/${from}/transactions/`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      Accept: 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
    },
    body: JSON.stringify({
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas: dataGas,
      dataGas,
      gasPrice,
      nonce: nonce.toString(),
      signatures,
      gasToken,
      refundReceiver,
    }),
  };
  let response = await fetch(url, options);
  if (!response?.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function executeSend(
  web3: Web3,
  prepaidCardAddress: string,
  spendAmount: number,
  rate: string,
  action: string,
  data: string,
  signatures: Signature[],
  nonce: BN
): Promise<GnosisExecTx> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  const url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/send/`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
      Accept: 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
    },
    body: JSON.stringify({
      nonce: nonce.toString(),
      payment: spendAmount,
      rate,
      action,
      data,
      signatures,
    }),
  };
  let response = await fetch(url, options);
  if (!response?.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export function getParamsFromEvent(web3: Web3, txnReceipt: TransactionReceipt, eventAbi: EventABI, address: string) {
  let eventParams = txnReceipt.logs
    .filter((log) => isEventMatch(log, eventAbi.topic, address))
    .map((log) => web3.eth.abi.decodeLog(eventAbi.abis, log.data, log.topics));
  return eventParams;
}

export function getNextNonceFromEstimate(estimate: Estimate | SendPayload): BN {
  if (estimate.lastUsedNonce == null) {
    estimate.lastUsedNonce = -1;
  }
  return new BN(estimate.lastUsedNonce + 1);
}

function isEventMatch(log: Log, topic: string, address: string) {
  return log.topics[0] === topic && log.address === address;
}
