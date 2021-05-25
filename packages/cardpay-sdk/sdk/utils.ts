/*global fetch */

import Web3 from 'web3';
import { TransactionReceipt } from 'web3-core';
import { networks } from './constants';
import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import { getConstant } from './constants.js';
import { Log } from 'web3-core';

export async function networkName(web3: Web3): Promise<string> {
  let id = await web3.eth.net.getId();
  let name = networks[id];
  if (!name) {
    throw new Error(`Don't know what name the network id ${id} is`);
  }
  return name;
}

const POLL_INTERVAL = 500;

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
export interface PayMerchantPayload extends Estimate {
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
export interface PayMerchantTx extends RelayTransaction {
  merchantAddress: string;
  payment: number; // this is not safe to use! Need to fix in relay server
  prepaidCardTxHash: string; // this is a hash of the txn data--not to be confused with the overall txn hash
  tokenAddress: string;
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

export async function getPayMerchantPayload(
  web3: Web3,
  prepaidCardAddress: string,
  merchantSafe: string,
  tokenAddress: string,
  amount: string
): Promise<PayMerchantPayload> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  let url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/pay-for-merchant/get-params/`;
  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
    },
    body: JSON.stringify({
      tokenAddress,
      merchantAddress: merchantSafe,
      payment: amount,
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
  signatureBytes.push(await signTypedData(web3, owner, typedData));

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

export async function executePayMerchant(
  web3: Web3,
  prepaidCardAddress: string,
  tokenAddress: string,
  merchantSafe: string,
  amount: string,
  signatures: Signature[],
  nonce: string
): Promise<PayMerchantTx> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  const url = `${relayServiceURL}/v1/prepaid-card/${prepaidCardAddress}/pay-for-merchant/`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', //eslint-disable-line @typescript-eslint/naming-convention
    },
    body: JSON.stringify({
      nonce,
      tokenAddress,
      merchantAddress: merchantSafe,
      payment: amount,
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

function isEventMatch(log: Log, topic: string, address: string) {
  return log.topics[0] === topic && log.address === address;
}

async function signTypedData(web3: Web3, account: string, data: any): Promise<Signature> {
  let result: string = await new Promise((resolve, reject) => {
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
  const sig = result.replace('0x', '');
  const sigV = parseInt(sig.slice(-2), 16);
  const sigR = Web3.utils.toBN('0x' + sig.slice(0, 64)).toString();
  const sigS = Web3.utils.toBN('0x' + sig.slice(64, 128)).toString();

  // Metamask with ledger returns v = 01, this is not valid for ethereum
  // For ethereum valid V is 27 or 28
  // In case V = 0 or 01 we add it to 27 and then add 4
  // Adding 4 is required to make signature valid for safe contracts:
  // https://gnosis-safe.readthedocs.io/en/latest/contracts/signatures.html#eth-sign-signature
  return {
    v: sigV,
    r: sigR,
    s: sigS,
  };
}
