import { AbiItem } from 'web3-utils';
import { ERC20ABI } from '@cardstack/cardpay-sdk/index.js';
import { getAddressByNetwork } from '@cardstack/cardpay-sdk';
import { ChainAddress } from './web3-strategies/types';

// symbols
export type ConvertibleSymbol = 'DAI' | 'CARD';
export type BridgeableSymbol = 'DAI' | 'CARD';
export type Layer1BalanceSymbol = 'DAI' | 'CARD' | 'ETH';
export type TokenSymbol =
  | ConvertibleSymbol
  | BridgeableSymbol
  | Layer1BalanceSymbol;
export type NetworkSymbol = 'kovan' | 'sokol' | 'mainnet' | 'xdai';

// conversion
// eslint-disable-next-line no-unused-vars
export type ConversionFunction = (amountInWei: string) => number;
export const convertibleSymbols: ConvertibleSymbol[] = ['DAI', 'CARD'];

// contract/bridging
export const bridgeableSymbols: BridgeableSymbol[] = ['DAI', 'CARD'];
const contractNames: Record<BridgeableSymbol, string> = {
  DAI: 'daiToken',
  CARD: 'cardToken',
};

export class TokenContractInfo {
  symbol: BridgeableSymbol;
  address: ChainAddress;
  abi = ERC20ABI as AbiItem[];

  constructor(symbol: BridgeableSymbol, network: string) {
    this.symbol = symbol;
    this.address = getAddressByNetwork(contractNames[this.symbol], network);
  }
}

// display only
interface DisplayInfo {
  name?: string;
  symbol: TokenSymbol;
  description?: string;
  icon: string;
}

const _tokenDisplayInfoMap: Record<TokenSymbol, DisplayInfo> = {
  ETH: {
    symbol: 'ETH',
    icon: 'ethereum-token',
  },
  CARD: {
    name: 'Card',
    symbol: 'CARD',
    description: 'ERC-20 Cardstack token',
    icon: 'card-token',
  },
  DAI: {
    name: 'Dai',
    symbol: 'DAI',
    description: 'USD-based stablecoin',
    icon: 'dai-token',
  },
};

export class TokenDisplayInfo implements DisplayInfo {
  name: string;
  symbol: TokenSymbol;
  description: string;
  icon: string;

  constructor(symbol: TokenSymbol) {
    this.symbol = symbol;
    let displayInfo = _tokenDisplayInfoMap[symbol];
    this.name = displayInfo.name!;
    this.description = displayInfo.description!;
    this.icon = displayInfo.icon;
  }

  static isRecognizedSymbol(value: string): value is TokenSymbol {
    return ['DAI', 'CARD', 'ETH'].includes(value);
  }

  static nameFor(symbol: TokenSymbol) {
    return _tokenDisplayInfoMap[symbol].name;
  }

  static descriptionFor(symbol: TokenSymbol) {
    return _tokenDisplayInfoMap[symbol].description;
  }

  static iconFor(symbol: TokenSymbol) {
    return _tokenDisplayInfoMap[symbol].icon;
  }
}
