/*global fetch */

import BN from 'bn.js';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import ERC677ABI from '../contracts/abi/erc-677.js';
import PrepaidCardManagerABI from '../contracts/abi/prepaid-card-manager';
import { getAddress } from '../contracts/addresses.js';
import { getConstant, ZERO_ADDRESS } from './constants.js';
import ExchangeRate from './exchange-rate';
import { ERC20ABI } from '../index.js';

const { toBN, fromWei } = Web3.utils;
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
interface PayMerchantPayload extends Estimate {
  data: any;
}
interface RelayTransaction {
  to: string;
  nonce: number;
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

interface PayMerchantTx extends RelayTransaction {
  merchantAddress: string;
  payment: number; // this is not safe to use! Need to fix in relay server
  prepaidCardTxHash: string; // this is a hash of the txn data--not to be confused with the overal txn hash
  tokenAddress: string;
}
interface GnosisExecTx extends RelayTransaction {
  value: number;
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

interface Signature {
  v: number;
  r: string;
  s: string | 0;
}

export default class PrepaidCard {
  private prepaidCardManager: Contract | undefined;
  constructor(private layer2Web3: Web3) {}

  async priceForFaceValue(tokenAddress: string, spendFaceValue: number): Promise<string> {
    return await (await this.getPrepaidCardMgr()).methods
      .priceForFaceValue(tokenAddress, String(spendFaceValue))
      .call();
  }

  async gasFee(tokenAddress: string): Promise<string> {
    return await (await this.getPrepaidCardMgr()).methods.gasFee(tokenAddress).call();
  }

  async issuingToken(prepaidCardAddress: string): Promise<string> {
    return (await (await this.getPrepaidCardMgr()).methods.cardDetails(prepaidCardAddress).call()).issueToken;
  }

  async payMerchant(
    merchantSafe: string,
    prepaidCardAddress: string,
    spendAmount: number,
    options?: ContractOptions
  ): Promise<PayMerchantTx> {
    if (spendAmount < 50) {
      // this is hard coded in the PrepaidCardManager contract
      throw new Error(`The amount to pay merchant §${spendAmount} SPEND is below the minimum allowable amount`);
    }
    let prepaidCardMgrAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let issuingToken = await this.issuingToken(prepaidCardAddress);
    let exchangeRate = new ExchangeRate(this.layer2Web3);
    let weiAmount = await exchangeRate.convertFromSpend(issuingToken, spendAmount);
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], issuingToken);
    let prepaidCardBalance = new BN(await token.methods.balanceOf(prepaidCardAddress).call());
    if (prepaidCardBalance.lt(new BN(weiAmount))) {
      throw new Error(
        `Prepaid card does not have enough balance to pay merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
          prepaidCardBalance.toString()
        )}, payment amount in issuing token is ${fromWei(weiAmount)}`
      );
    }
    let payload = await this.getPayMerchantPayload(prepaidCardAddress, merchantSafe, issuingToken, weiAmount);
    if (payload.lastUsedNonce == null) {
      payload.lastUsedNonce = -1;
    }
    let signatures = await this.sign(
      issuingToken,
      0,
      payload.data,
      0,
      payload.safeTxGas,
      payload.dataGas,
      payload.gasPrice,
      payload.gasToken,
      ZERO_ADDRESS,
      toBN(payload.lastUsedNonce + 1),
      from,
      prepaidCardAddress
    );
    let contractSignature: Signature = {
      v: 1,
      r: toBN(prepaidCardMgrAddress).toString(),
      s: 0,
    };
    // The hash for the signatures requires that owner signatures be sorted by address
    if (prepaidCardMgrAddress.toLowerCase() > from.toLowerCase()) {
      signatures = signatures.concat(contractSignature);
    } else {
      signatures = [contractSignature].concat(signatures);
    }

    let result = await this.executePayMerchant(
      prepaidCardAddress,
      issuingToken,
      merchantSafe,
      weiAmount,
      signatures,
      toBN(payload.lastUsedNonce + 1).toString()
    );
    return result;
  }

  async create(
    safeAddress: string,
    tokenAddress: string,
    faceValues: number[],
    options?: ContractOptions
  ): Promise<GnosisExecTx> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let amountCache = new Map<number, string>();
    let amounts: BN[] = [];
    for (let faceValue of faceValues) {
      let weiAmount = amountCache.get(faceValue);
      if (weiAmount == null) {
        weiAmount = await this.priceForFaceValue(tokenAddress, faceValue);
        amountCache.set(faceValue, weiAmount);
      }
      amounts.push(new BN(weiAmount));
    }
    let payload = await this.getCreateCardPayload(from, tokenAddress, amounts);
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

  private async getPrepaidCardMgr() {
    if (this.prepaidCardManager) {
      return this.prepaidCardManager;
    }
    this.prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    return this.prepaidCardManager;
  }

  private async getCreateCardPayload(owner: string, tokenAddress: string, amounts: BN[]): Promise<string> {
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

  private async getPayMerchantPayload(
    prepaidCardAddress: string,
    merchantSafe: string,
    tokenAddress: string,
    amount: string
  ): Promise<PayMerchantPayload> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
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

  private async gasEstimate(
    from: string,
    to: string,
    value: string,
    data: string,
    operation: number,
    gasToken: string
  ): Promise<Estimate> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
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
  ): Promise<GnosisExecTx> {
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

  private async executePayMerchant(
    prepaidCardAddress: string,
    tokenAddress: string,
    merchantSafe: string,
    amount: string,
    signatures: Signature[],
    nonce: string
  ): Promise<PayMerchantTx> {
    let relayServiceURL = await getConstant('relayServiceURL', this.layer2Web3);
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
}
