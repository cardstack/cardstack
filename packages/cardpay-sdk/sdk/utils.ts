/*global fetch */

import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { networks } from './constants';
import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import { getConstant } from './constants.js';

export async function networkName(web3: Web3): Promise<string> {
  let id = await web3.eth.net.getId();
  let name = networks[id];
  if (!name) {
    throw new Error(`Don't know what name the network id ${id} is`);
  }
  return name;
}

const POLL_INTERVAL = 500;

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

export interface Signature {
  v: number;
  r: string;
  s: string | 0;
}

export function waitUntilTransactionMined(web3: Web3, txnHash: string): Promise<TransactionReceipt> {
  let transactionReceiptAsync = async function (
    txnHash: string,
    resolve: (value: TransactionReceipt | Promise<TransactionReceipt>) => void,
    reject: (reason?: any) => void
  ) {
    try {
      let receipt = await web3.eth.getTransactionReceipt(txnHash);
      if (!receipt) {
        setTimeout(function () {
          transactionReceiptAsync(txnHash, resolve, reject);
        }, POLL_INTERVAL);
      } else {
        resolve(receipt);
      }
    } catch (e) {
      reject(e);
    }
  };

  return new Promise(function (resolve, reject) {
    transactionReceiptAsync(txnHash, resolve, reject);
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

export async function sign(
  web3: Web3,
  to: string,
  value: number,
  data: any,
  operation: number,
  txGasEstimate: string,
  baseGasEstimate: string,
  gasPrice: string,
  txGasToken: string,
  refundReceiver: string,
  nonce: any,
  owner: string,
  gnosisSafeAddress: string
): Promise<Signature[]> {
  const typedData = {
    types: {
      //eslint-disable-next-line @typescript-eslint/naming-convention
      EIP712Domain: [{ type: 'address', name: 'verifyingContract' }],
      // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
      //eslint-disable-next-line @typescript-eslint/naming-convention
      SafeTx: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'value' },
        { type: 'bytes', name: 'data' },
        { type: 'uint8', name: 'operation' },
        { type: 'uint256', name: 'safeTxGas' },
        { type: 'uint256', name: 'baseGas' },
        { type: 'uint256', name: 'gasPrice' },
        { type: 'address', name: 'gasToken' },
        { type: 'address', name: 'refundReceiver' },
        { type: 'uint256', name: 'nonce' },
      ],
    },
    domain: {
      verifyingContract: gnosisSafeAddress,
    },
    primaryType: 'SafeTx',
    message: {
      to: to,
      value: value,
      data: data,
      operation: operation,
      safeTxGas: txGasEstimate,
      baseGas: baseGasEstimate,
      gasPrice: gasPrice,
      gasToken: txGasToken,
      refundReceiver: refundReceiver,
      nonce: nonce.toNumber(),
    },
  };
  const signatureBytes = [];
  const sig = await signTypedData(web3, owner, typedData);
  signatureBytes.push(ethSignSignatureToRSVForSafe(sig));

  return signatureBytes;
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
  nonce: string,
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
      nonce,
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

export function signTypedData(web3: Web3, account: string, data: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let provider = web3.currentProvider;
    if (typeof provider === 'string') {
      throw new Error(`The provider ${web3.currentProvider} is not supported`);
    }
    if (provider == null) {
      throw new Error('No provider configured');
    }
    //@ts-ignore TS is complaining that provider might be undefined--but the
    //check above should prevent that from ever happening
    provider.send(
      {
        jsonrpc: '2.0',
        method: 'eth_signTypedData',
        params: [account, data],
        id: new Date().getTime(),
      },
      (err, response) => {
        if (err) {
          return reject(err);
        }
        resolve(response?.result);
      }
    );
  });
}

export function ethSignSignatureToRSVForSafe(ethSignSignature: string) {
  const sig = ethSignSignature.replace('0x', '');
  const sigV = parseInt(sig.slice(-2), 16);
  const sigR = Web3.utils.toBN('0x' + sig.slice(0, 64)).toString();
  const sigS = Web3.utils.toBN('0x' + sig.slice(64, 128)).toString();

  return {
    v: sigV,
    r: sigR,
    s: sigS,
  };
}
