/*global fetch */

import Web3 from 'web3';
import PrepaidCardManagerABI from '../../contracts/v0.2.0/abi/prepaid-card-manager';
import RevenuePoolABI from '../../contracts/v0.2.0/abi/revenue-pool';
import BridgeUtilsABI from '../../contracts/v0.2.0/abi/bridge-utils';
import ERC20ABI from '../../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../../contracts/addresses';
import { getConstant, ZERO_ADDRESS } from '../constants';
import { ContractOptions } from 'web3-eth-contract';
import { GnosisExecTx, gasEstimate, executeTransaction } from '../utils/safe-utils';
import { sign } from '../utils/signing-utils';
import { getSDK } from '../version-resolver';
import BN from 'bn.js';
const { toBN, fromWei } = Web3.utils;

export type Safe = DepotSafe | PrepaidCardSafe | MerchantSafe | ExternalSafe;
interface BaseSafe {
  address: string;
  tokens: TokenInfo[];
}
export interface DepotSafe extends BaseSafe {
  type: 'depot';
}
export interface MerchantSafe extends BaseSafe {
  type: 'merchant';
}
export interface ExternalSafe extends BaseSafe {
  type: 'external';
}
export interface PrepaidCardSafe extends BaseSafe {
  type: 'prepaid-card';
  issuingToken: string;
  spendFaceValue: number;
  issuer: string;
  reloadable: boolean;
}
interface TokenInfo {
  tokenAddress: string;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    logoUri: string;
  };
  balance: string; // balance is in wei
}

export default class Safes {
  constructor(private layer2Web3: Web3) {}

  async view(owner?: string): Promise<Safe[]> {
    owner = owner ?? (await this.layer2Web3.eth.getAccounts())[0];
    let transactionServiceURL = await getConstant('transactionServiceURL', this.layer2Web3);
    let response = await fetch(`${transactionServiceURL}/v1/owners/${owner}/`);
    let { safes } = (await response.json()) as { safes: string[] };
    let prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    let revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    let bridgeUtils = new this.layer2Web3.eth.Contract(
      BridgeUtilsABI as AbiItem[],
      await getAddress('bridgeUtils', this.layer2Web3)
    );

    let exchangeRate = await getSDK('ExchangeRate', this.layer2Web3);

    return await Promise.all(
      safes.map(async (safeAddress: string) => {
        let balanceResponse = await fetch(`${transactionServiceURL}/v1/safes/${safeAddress}/balances/`);
        if (!balanceResponse?.ok) {
          throw new Error(await balanceResponse.text());
        }
        let balances: TokenInfo[] = await balanceResponse.json();
        let tokens = balances.filter((balanceItem) => balanceItem.tokenAddress);
        let safeInfo = { address: safeAddress, tokens };
        let { issuer, issueToken: issuingToken, reloadable } = await prepaidCardManager.methods
          .cardDetails(safeAddress)
          .call();

        // prepaid card safe
        if (issuer !== ZERO_ADDRESS) {
          let issuingTokenBalance =
            tokens.find((t) => t.tokenAddress.toLowerCase() === issuingToken.toLowerCase())?.balance ?? '0';
          return {
            ...safeInfo,
            type: 'prepaid-card' as 'prepaid-card',
            issuer,
            issuingToken,
            reloadable,
            spendFaceValue: await exchangeRate.convertToSpend(issuingToken, issuingTokenBalance),
          };
        }
        let supplier = await bridgeUtils.methods.safes(safeAddress).call();
        if (supplier !== ZERO_ADDRESS) {
          return {
            ...safeInfo,
            type: 'depot' as 'depot',
          };
        }
        let isMerchantSafe = await revenuePool.methods.isMerchantSafe(safeAddress).call();
        if (isMerchantSafe) {
          return {
            ...safeInfo,
            type: 'merchant' as 'merchant',
          };
        }
        return {
          ...safeInfo,
          type: 'external' as 'external',
        };
      })
    );
  }

  async sendTokens(
    safeAddress: string,
    tokenAddress: string,
    recipient: string,
    amount: string,
    options?: ContractOptions
  ): Promise<GnosisExecTx> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let safeBalance = new BN(await token.methods.balanceOf(safeAddress).call());
    if (safeBalance.lt(new BN(amount))) {
      throw new Error(
        `Safe does not have enough balance to transfer tokens. The token ${tokenAddress} balance of safe ${safeAddress} is ${fromWei(
          safeAddress.toString()
        )}, amount to transfer ${fromWei(amount)}`
      );
    }
    let payload = await this.transferTokenPayload(tokenAddress, recipient, amount);
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, tokenAddress, '0', payload, 0, tokenAddress);
    if (estimate.lastUsedNonce == null) {
      estimate.lastUsedNonce = -1;
    }
    let signatures = await sign(
      this.layer2Web3,
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
    let result = await executeTransaction(
      this.layer2Web3,
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

  private async transferTokenPayload(tokenAddress: string, recipient: string, amount: string): Promise<string> {
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);

    return token.methods.transfer(recipient, amount).encodeABI();
  }
}
