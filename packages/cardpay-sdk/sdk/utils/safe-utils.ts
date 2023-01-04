/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { TransactionReceipt, Log } from 'web3-core';
import { getConstant, ZERO_ADDRESS } from '../constants';
import { getSDK } from '../version-resolver';
import { Signature } from './signing-utils';
import PrepaidCardManagerABI from '../../contracts/abi/v0.9.0/prepaid-card-manager';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../../contracts/addresses';
import GnosisSafeProxyFactoryABI from '../../contracts/abi/gnosis-safe-proxy-factory';
import GnosisSafeABI from '../../contracts/abi/gnosis-safe';
import { Transaction, isJsonRpcProvider } from './general-utils';
/* eslint-disable node/no-extraneous-import */
import { Contract, ethers, utils } from 'ethers';
import { AddressZero } from '@ethersproject/constants';
import { Interface, LogDescription } from 'ethers/lib/utils';
import JsonRpcProvider from '../../providers/json-rpc-provider';
import { BigNumber } from 'ethers';

export interface EventABI {
  topic: string;
  abis: { type: string; name: string; indexed?: boolean }[];
}

export interface CreateSafe {
  safe: string;
  masterCopy: string;
  proxyFactory: string;
  paymentToken: string;
  payment: string;
  paymentReceiver: string;
  gasToken: string;
  setupData: string;
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

export interface GasEstimate {
  amount: BN;
  gasToken: string;
}

export enum Operation {
  CALL = 0,
  DELEGATECALL = 1,
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

export async function createSafe(
  web3: Web3,
  owners: string[],
  threshold: number,
  saltNonce: string,
  paymentToken: string
): Promise<CreateSafe> {
  let relayServiceURL = await getConstant('relayServiceURL', web3);
  let url = `${relayServiceURL}/v3/safes/`;
  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      owners,
      threshold,
      saltNonce,
      paymentToken,
    }),
  };
  let response = await fetch(url, options);
  if (!response?.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

export async function gasEstimate(
  web3OrEthersProvider: Web3 | JsonRpcProvider,
  from: string,
  to: string,
  value: string,
  data: string,
  operation: Operation,
  gasToken: string
): Promise<Estimate> {
  let relayServiceURL = await getConstant('relayServiceURL', web3OrEthersProvider);
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
  web3OrEthersProvider: Web3 | JsonRpcProvider,
  from: string,
  to: string,
  data: any,
  operation: Operation,
  estimate: Estimate,
  nonce: BN,
  signatures: any,
  eip1271Data?: string
): Promise<GnosisExecTx> {
  let relayServiceURL = await getConstant('relayServiceURL', web3OrEthersProvider);
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
      operation: operation,
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

export async function generateCreate2SafeTx(
  ethersProvider: JsonRpcProvider,
  owners: string[],
  treshold: number,
  to: string,
  data: string,
  fallbackHandler: string,
  paymentToken: string,
  payment: string,
  paymentReceiver: string,
  saltNonce: string
) {
  let gnosisSafeProxyFactory = new Contract(
    await getAddress('gnosisProxyFactory_v1_3', ethersProvider),
    GnosisSafeProxyFactoryABI,
    ethersProvider
  );
  let gnosisSafeMasterCopy = new Contract(
    await getAddress('gnosisSafeMasterCopy', ethersProvider),
    GnosisSafeABI,
    ethersProvider
  );

  let initializer = gnosisSafeMasterCopy.interface.encodeFunctionData('setup', [
    owners,
    treshold,
    to,
    data,
    fallbackHandler,
    paymentToken,
    payment,
    paymentReceiver,
  ]);
  let expectedSafeAddress = await calculateCreateProxyWithNonceAddress(
    gnosisSafeProxyFactory,
    gnosisSafeMasterCopy.address,
    initializer,
    saltNonce
  );

  let create2SafeData = gnosisSafeProxyFactory.interface.encodeFunctionData('createProxyWithNonce', [
    gnosisSafeMasterCopy.address,
    initializer,
    saltNonce,
  ]);
  let create2SafeTx: Transaction = {
    to: gnosisSafeProxyFactory.address,
    value: '0',
    data: create2SafeData,
    operation: Operation.CALL,
  };

  return { expectedSafeAddress, create2SafeTx };
}

async function calculateCreateProxyWithNonceAddress(
  gnosisSafeProxyFactory: Contract,
  masterCopyAddress: string,
  initializer: string,
  saltNonce: string
) {
  let expectedSafeAddress = AddressZero;
  try {
    await gnosisSafeProxyFactory.estimateGas.calculateCreateProxyWithNonceAddress(
      masterCopyAddress,
      initializer,
      saltNonce
    );
  } catch (e: any) {
    expectedSafeAddress = getSafeAddressFromRevertMessage(e);
  }

  return expectedSafeAddress;
}

function getSafeAddressFromRevertMessage(e: any): string {
  let safeAddress;
  if (e.data) {
    safeAddress = ethers.utils.getAddress(e.data.slice(138, 178));
  } else {
    let messages: string[] = e.message.split(' ');
    safeAddress = messages.find((m) => m.match(/^0x[a-fA-F0-9]{40,44}$/))?.replace(',', '') ?? AddressZero;
  }
  return safeAddress;
}

export async function getSafeVersion(
  web3OrEthersProvider: Web3 | JsonRpcProvider,
  gnosisSafeAddress: string
): Promise<string> {
  let safeVersion;
  if (isJsonRpcProvider(web3OrEthersProvider)) {
    safeVersion = getSafeVersionWithEthers(web3OrEthersProvider, gnosisSafeAddress);
  } else {
    safeVersion = getSafeVersionWithWeb3(web3OrEthersProvider, gnosisSafeAddress);
  }

  return safeVersion;
}

async function getSafeVersionWithWeb3(web3: Web3, gnosisSafeAddress: string): Promise<string> {
  let safeVersion;
  let safe = new web3.eth.Contract(GnosisSafeABI as AbiItem[], gnosisSafeAddress);
  try {
    safeVersion = await safe.methods.VERSION().call();
  } catch (e) {
    safe = new web3.eth.Contract(GnosisSafeABI as AbiItem[], await getAddress('gnosisSafeMasterCopy', web3));
    safeVersion = await safe.methods.VERSION().call();
  }

  return safeVersion;
}

async function getSafeVersionWithEthers(ethersProvider: JsonRpcProvider, gnosisSafeAddress: string): Promise<string> {
  let safeVersion;
  let safe = new Contract(gnosisSafeAddress, GnosisSafeABI, ethersProvider);
  try {
    safeVersion = await safe.callStatic.VERSION();
  } catch (e) {
    safe = new Contract(await getAddress('gnosisSafeMasterCopy', ethersProvider), GnosisSafeABI, ethersProvider);
    safeVersion = await safe.callStatic.VERSION();
  }

  return safeVersion;
}

// allow TransactionReceipt as argument
// eslint-disable-next-line @typescript-eslint/ban-types
export function getParamsFromEvent(web3: Web3, txnReceipt: TransactionReceipt, eventAbi: EventABI, address: string) {
  let eventParams = txnReceipt.logs
    .filter((log) => isEventMatch(log, eventAbi.topic, address))
    .map((log) => web3.eth.abi.decodeLog(eventAbi.abis, log.data, log.topics.slice(1)));
  return eventParams;
}

export async function getSafeProxyCreationEvent(
  ethersProvider: JsonRpcProvider,
  logs: Log[]
): Promise<LogDescription[]> {
  let _interface = new utils.Interface(GnosisSafeProxyFactoryABI);
  let gnosisProxyFactoryAddress = await getAddress('gnosisProxyFactory_v1_3', ethersProvider);
  let events = logs
    .filter((log) => isSafeProxyCreationEvent(gnosisProxyFactoryAddress, _interface, log))
    .map((log) => _interface.parseLog(log));
  return events;
}

function isSafeProxyCreationEvent(gnosisProxyFactoryAddress: string, _interface: Interface, log: Log): boolean {
  return log.address === gnosisProxyFactoryAddress && log.topics[0] === _interface.getEventTopic('ProxyCreation');
}

export function getNextNonceFromEstimate(estimate: Estimate | SendPayload): BN {
  if (estimate.lastUsedNonce == null) {
    estimate.lastUsedNonce = -1;
  }
  return new BN(estimate.lastUsedNonce + 1);
}

function isEventMatch(log: Log, topic: string, address: string) {
  return log.topics[0] === topic && log.address.toLowerCase() === address.toLowerCase();
}

export function gasInToken(estimate: Estimate): BN {
  let gasUnits = new BN(String(estimate.baseGas)).add(new BN(String(estimate.safeTxGas)));
  return gasUnits.mul(new BN(String(estimate.gasPrice)));
}

// In the relayer, there is a check for sufficient funds inside the safe
// The issue with occurs when want to withdraw/transfer full balances from the safe
// The full amount has to be deducted for gas (usually it is pre-estimated).
// This gas is estimated and can be inaccurate so we intentionally over-estimate the gas
// to avoid a discrepancy between gas estimation of the relayer and the sdk.
// The number is based off empirical observation of sentry errors; the baseGas difference is usually 12
// https://github.com/cardstack/card-protocol-relay-service/blob/master/safe.py#L303-L316
export const baseGasBuffer: BN = new BN('30');

interface BalanceEntry {
  tokenAddress: string | null;
  balance: string;
  token: {
    decimals: number;
    logoUri: string;
    name: string;
    symbol: string;
  } | null;
}

interface BalanceSummary {
  tokenAddress: string;
  symbol: string;
  balance: BigNumber;
  decimals: number;
}

export async function getTokenBalancesForSafe(
  provider: JsonRpcProvider,
  tokenAddresses: string[],
  safeAddress: string
): Promise<BalanceSummary[]> {
  let baseUrl = await getConstant('safeTransactionServiceUrl', provider);

  if (!baseUrl) {
    throw new Error('Could not find safe transaction service url for current network');
  }
  let response = await fetch(`${baseUrl}/api/v1/safes/${safeAddress}/balances/`);

  if (!response?.ok) {
    throw new Error(await response.text());
  }
  let balances: BalanceEntry[] = await response.json();

  return tokenAddresses
    .map((tokenAddress) => {
      let balanceInfo = balances.find((b) => b.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase());

      if (balanceInfo?.token) {
        let {
          balance,
          token: { symbol, decimals },
        } = balanceInfo;

        return { tokenAddress, symbol, balance: BigNumber.from(balance), decimals };
      } else {
        return null;
      }
    })
    .filter((e) => !!e) as BalanceSummary[];
}
