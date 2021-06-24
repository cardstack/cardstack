import { TokenSymbol } from '@cardstack/web-client/utils/token';
import BN from 'web3-core/node_modules/@types/bn.js';

export const faceValueOptions = [5000, 10000, 50000, 100000];
export const spendToUsdRate = 0.01;

export interface Token {
  address?: string;
  balance?: BN;
  icon: string;
  name: string;
  description?: string;
  symbol: TokenSymbol;
}
