/*global fetch */

import Web3 from 'web3';
import PrepaidCardManagerABI from '../contracts/abi/prepaid-card-manager.js';
import { getAddress } from '../contracts/addresses.js';
import { getConstant, ZERO_ADDRESS } from './constants.js';

interface SafeInfo {
  address: string;
  isPrepaidCard: boolean;
  tokens: TokenInfo[];
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
      PrepaidCardManagerABI as any,
      await getAddress('prepaidCardManager', this.layer2Web3)
    );

    return await Promise.all(
      safes.map(async (safeAddress: string) => {
        const { issuer } = await prepaidCardManager.methods.cardDetails(safeAddress).call();
        const isPrepaidCard = issuer !== ZERO_ADDRESS;

        let balanceResponse = await fetch(`${transactionServiceURL}/v1/safes/${safeAddress}/balances/`);
        if (!balanceResponse?.ok) {
          throw new Error(await balanceResponse.text());
        }

        const balances: TokenInfo[] = await balanceResponse.json();

        return {
          address: safeAddress,
          isPrepaidCard,
          tokens: balances.filter((balanceItem) => balanceItem.tokenAddress),
        };
      })
    );
  }
}
