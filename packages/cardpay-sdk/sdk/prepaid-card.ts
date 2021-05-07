/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { ContractOptions } from 'web3-eth-contract';
import ERC677ABI from '../contracts/abi/erc-677.js';
import PrepaidCardManagerABI from '../contracts/abi/prepaid-card-manager';
import { getAddress } from '../contracts/addresses.js';
import { getConstant, ZERO_ADDRESS } from './constants.js';

const { toBN } = Web3.utils;
interface Estimate {
  safeTxGas: string;
  baseGas: string;
  dataGas: string;
  operationalGas: string;
  gasPrice: string;
  lastUsedNonce: number | undefined;
  gasToken: string;
  refundReceiver: string;
}
interface RelayTransaction {
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
  value: number;
  data: string;
  timestamp: string;
  operation: string;
  safeTxGas: number;
  dataGas: number;
  gasPrice: number;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
  safeTxHash: string;
  txHash: string;
  transactionHash: string;
}

interface Signature {
  v: number;
  r: string;
  s: string;
}

export default class PrepaidCard {
  constructor(private layer2Web3: Web3) {}

  async priceForFaceValue(tokenAddress: string, spendFaceValue: number): Promise<string> {
    let prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    return await prepaidCardManager.methods.priceForFaceValue(tokenAddress, String(spendFaceValue)).call();
  }

  async gasFee(tokenAddress: string): Promise<string> {
    let prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    return await prepaidCardManager.methods.gasFee(tokenAddress).call();
  }

  async create(
    safeAddress: string,
    tokenAddress: string,
    amounts: string[],
    options?: ContractOptions
  ): Promise<RelayTransaction> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let payload = await this.getPayload(
      from,
      tokenAddress,
      amounts.map((amount) => new BN(amount))
    );
    let estimate = await this.gasEstimate(safeAddress, tokenAddress, '0', payload, 0, tokenAddress);

    if (estimate.lastUsedNonce == null) {
      estimate.lastUsedNonce = -1;
    }
    let signatures = await this.sign(
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      estimate.gasToken,
      ZERO_ADDRESS,
      toBN(estimate.lastUsedNonce + 1),
      from,
      safeAddress
    );
    let result = await this.executeTransaction(
      safeAddress,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      toBN(estimate.lastUsedNonce + 1).toString(),
      signatures,
      estimate.gasToken,
      ZERO_ADDRESS
    );
    return result;
  }

  private async getPayload(owner: string, tokenAddress: string, amounts: BN[]): Promise<string> {
    let prepaidCardManagerAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let token = new this.layer2Web3.eth.Contract(ERC677ABI as AbiItem[], tokenAddress);
    let sum = new BN(0);
    for (let amount of amounts) {
      sum = sum.add(amount);
    }

    return token.methods
      .transferAndCall(
        prepaidCardManagerAddress,
        sum,
        this.layer2Web3.eth.abi.encodeParameters(['address', 'uint256[]'], [owner, amounts])
      )
      .encodeABI();
  }

  private async gasEstimate(
    from: string,
    to: string,
    value: string,
    data: string,
    operation: number,
    gasToken: string
  ): Promise<Estimate> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
    const url = `${relayServiceURL}/v2/safes/${from}/transactions/estimate/`;
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
        gasToken,
      }),
    };
    let response = await fetch(url, options);
    if (!response?.ok) {
      throw new Error(await response.text());
    }
    return await response.json();
  }

  private async sign(
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
    signatureBytes.push(await this.signTypedData(owner, typedData));

    return signatureBytes;
  }

  private async signTypedData(account: string, data: any): Promise<Signature> {
    let result: string = await new Promise((resolve, reject) => {
      let provider = this.layer2Web3.currentProvider;
      if (typeof provider === 'string') {
        throw new Error(`The provider ${this.layer2Web3.currentProvider} is not supported`);
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

  private async executeTransaction(
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
  ): Promise<RelayTransaction> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
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
}
