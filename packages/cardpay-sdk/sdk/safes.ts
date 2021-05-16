/*global fetch */

import Web3 from 'web3';
import PrepaidCardManagerABI from '../contracts/abi/prepaid-card-manager';
import RevenuePoolABI from '../contracts/abi/revenue-pool';
import BridgeUtilsABI from '../contracts/abi/bridge-utils';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../contracts/addresses';
import { getConstant, ZERO_ADDRESS } from './constants';
import ExchangeRate from './exchange-rate';

export type Safe = DepotSafe | PrepaidCardSafe | MerchantSafe | ExternalSafe;
interface BaseSafe {
  address: string;
  tokens: TokenInfo[];
}
export interface DepotSafe extends BaseSafe {
  type: 'depot';
}
interface MerchantSafe extends BaseSafe {
  type: 'merchant';
}
interface ExternalSafe extends BaseSafe {
  type: 'external';
}
interface PrepaidCardSafe extends BaseSafe {
  type: 'prepaid-card';
  issuingToken: string;
  spendFaceValue: number;
  issuer: string;
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

    let exchangeRate = new ExchangeRate(this.layer2Web3);

    return await Promise.all(
      safes.map(async (safeAddress: string) => {
        let balanceResponse = await fetch(`${transactionServiceURL}/v1/safes/${safeAddress}/balances/`);
        if (!balanceResponse?.ok) {
          throw new Error(await balanceResponse.text());
        }
        let balances: TokenInfo[] = await balanceResponse.json();
        let tokens = balances.filter((balanceItem) => balanceItem.tokenAddress);
        let safeInfo = { address: safeAddress, tokens };
        let { issuer, issueToken: issuingToken } = await prepaidCardManager.methods.cardDetails(safeAddress).call();

        // prepaid card safe
        if (issuer !== ZERO_ADDRESS) {
          let issuingTokenBalance =
            tokens.find((t) => t.tokenAddress.toLowerCase() === issuingToken.toLowerCase())?.balance ?? '0';
          return {
            ...safeInfo,
            type: 'prepaid-card' as 'prepaid-card',
            issuer,
            issuingToken,
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
}
