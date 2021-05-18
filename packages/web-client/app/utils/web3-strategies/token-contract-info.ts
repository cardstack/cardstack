import { AbiItem } from 'web3-utils';
import { ERC20ABI } from '@cardstack/cardpay-sdk/index.js';
import { getAddressByNetwork } from '@cardstack/cardpay-sdk';
import { ChainAddress } from './types';

type TokenSymbol = 'DAI' | 'CARD';
const contractNames: Record<TokenSymbol, string> = {
  DAI: 'daiToken',
  CARD: 'cardToken',
};

export class TokenContractInfo {
  symbol: TokenSymbol;
  address: ChainAddress;
  abi = ERC20ABI as AbiItem[];

  constructor(symbol: TokenSymbol, network: string) {
    this.symbol = symbol;
    this.address = getAddressByNetwork(contractNames[this.symbol], network);
  }
}
