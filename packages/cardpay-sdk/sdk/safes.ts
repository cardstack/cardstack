/*global fetch */

import Web3 from 'web3';
import PrepaidCardManagerABI from '../contracts/abi/prepaid-card-manager';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../contracts/addresses';
import { getConstant, ZERO_ADDRESS } from './constants';
import ExchangeRate from './exchange-rate';

type SafeInfo = DepotInfo | PrepaidCardInfo;
interface DepotInfo {
  isPrepaidCard: false;
  address: string;
  tokens: TokenInfo[];
}

interface PrepaidCardInfo {
  isPrepaidCard: true;
  address: string;
  tokens: TokenInfo[];
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

  async view(owner?: string): Promise<SafeInfo[]> {
    owner = owner ?? (await this.layer2Web3.eth.getAccounts())[0];
    let transactionServiceURL = await getConstant('transactionServiceURL', this.layer2Web3);
    let response = await fetch(`${transactionServiceURL}/v1/owners/${owner}/`);
    let { safes } = (await response.json()) as { safes: string[] };
    let prepaidCardManager = new this.layer2Web3.eth.Contract(
      PrepaidCardManagerABI as AbiItem[],
      await getAddress('prepaidCardManager', this.layer2Web3)
    );
    let exchangeRate = new ExchangeRate(this.layer2Web3);

    return await Promise.all(
      safes.map(async (safeAddress: string) => {
        let balanceResponse = await fetch(`${transactionServiceURL}/v1/safes/${safeAddress}/balances/`);
        if (!balanceResponse?.ok) {
          throw new Error(await balanceResponse.text());
        }
        let { issuer, issueToken: issuingToken } = await prepaidCardManager.methods.cardDetails(safeAddress).call();
        let balances: TokenInfo[] = await balanceResponse.json();
        let tokens = balances.filter((balanceItem) => balanceItem.tokenAddress);
        let issuingTokenBalance =
          tokens.find((t) => t.tokenAddress.toLowerCase() === issuingToken.toLowerCase())?.balance ?? '0';

        let isPrepaidCard = issuer !== ZERO_ADDRESS;
        if (!isPrepaidCard) {
          return {
            isPrepaidCard: false,
            address: safeAddress,
            tokens,
          } as DepotInfo;
        } else {
          return {
            isPrepaidCard: true,
            address: safeAddress,
            tokens,
            issuer,
            issuingToken,
            spendFaceValue: await exchangeRate.convertToSpend(issuingToken, issuingTokenBalance),
          } as PrepaidCardInfo;
        }
      })
    );
  }
}
