/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt, Log } from 'web3-core';
import { getConstant, ZERO_ADDRESS } from '../constants';
import { getSDK } from '../version-resolver';
import { Signature } from './signing-utils';
import PrepaidCardManagerABI from '../../contracts/abi/v0.8.3/prepaid-card-manager';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../../contracts/addresses';

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
      'Content-Type': 'application/json',
      Accept: 'application/json',
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

export async function executeSendWithRateLock(
  web3: Web3,
  prepaidCardAddress: string,
  execute: (rateLock: string) => Promise<GnosisExecTx | undefined>
) {
  let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
  let prepaidCardManager = new web3.eth.Contract(
    PrepaidCardManagerABI as AbiItem[],
    await getAddress('prepaidCardManager', web3)
  );
  let issuingToken = (await prepaidCardManager.methods.cardDetails(prepaidCardAddress).call()).issueToken;
  let result: GnosisExecTx | undefined;
  let rateChanged = false;
  do {
    let rateLock = await layerTwoOracle.getRateLock(issuingToken);
    try {
      result = await execute(rateLock);
      break;
    } catch (e: any) {
      // The rate updates about once an hour, so if this is triggered, it should only be once
      if (e.message.includes('rate is beyond the allowable bounds')) {
        rateChanged = true;
        // TODO in this situation we should surface a message to the user that
        // the rate has changed and that we need to try again with a new rate
        console.warn(
          'The USD rate has fluctuated beyond allowable bounds between when the txn was signed and when it was executed, prompting the user to sign the txn again with a new rate'
        );
      } else {
        throw e;
      }
    }
  } while (rateChanged);
  return result;
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
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
  data: any,
  estimate: Estimate,
  nonce: BN,
  signatures: any,
  eip1271Data?: string
): Promise<GnosisExecTx> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  const url = `${relayServiceURL}/v1/safes/${from}/transactions/`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      to,
      value: 0, // we don't have any safe tx with a value
      data,
      operation: 0, // all our safe txs are CALL operations
      safeTxGas: estimate.safeTxGas,
      baseGas: estimate.baseGas,
      dataGas: estimate.dataGas,
      gasPrice: estimate.gasPrice,
      nonce: nonce.toString(),
      signatures,
      gasToken: estimate.gasToken,
      refundReceiver: ZERO_ADDRESS,
      eip1271Data,
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
  payload: SendPayload,
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
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      nonce: nonce.toString(),
      payment: spendAmount,
      rate,
      action,
      data,
      gasPrice: payload.gasPrice,
      safeTxGas: payload.safeTxGas,
      dataGas: payload.dataGas,
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
