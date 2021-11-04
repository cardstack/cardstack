import { AbiItem } from 'web3-utils';
import { ERC20ABI } from '@cardstack/cardpay-sdk/index.js';
import { getAddressByNetwork, AddressKeys } from '@cardstack/cardpay-sdk';
import { ChainAddress } from './web3-strategies/types';
import { NetworkSymbol } from './web3-strategies/types';
import BN from 'bn.js';

// symbols
export const tokenSymbols = {
  DAI: 'DAI',
  CARD: 'CARD',
  'DAI.CPXD': 'DAI.CPXD',
  'CARD.CPXD': 'CARD.CPXD',
  ETH: 'ETH',
} as const;
export type TokenSymbol = keyof typeof tokenSymbols;

// conversion
export const convertibleSymbols = [
  tokenSymbols.DAI,
  tokenSymbols.CARD,
  tokenSymbols['DAI.CPXD'],
  tokenSymbols['CARD.CPXD'],
] as const;

// contract/bridging
export const bridgeableSymbols = [tokenSymbols.DAI, tokenSymbols.CARD] as const;
export const bridgedSymbols = [
  'DAI.CPXD',
  'CARD.CPXD',
  'DAI', // Remove once Sokol is fixed to use DAI.CPXD
  'CARD', // Remove once Sokol is fixed to use CARD.CPXD
] as const;

// layer 1 token symbols
export const layer1TokenSymbols = [tokenSymbols.DAI, tokenSymbols.CARD];
export type Layer1TokenSymbol = typeof layer1TokenSymbols[number];

// symbol categories
export type ConvertibleSymbol = typeof convertibleSymbols[number];
export type BridgeableSymbol = typeof bridgeableSymbols[number];
export type BridgedTokenSymbol = typeof bridgedSymbols[number];

export type ConversionFunction = (amountInWei: string) => number;

const contractNames: Record<
  NetworkSymbol,
  Partial<Record<TokenSymbol, string>>
> = {
  kovan: {
    DAI: 'daiToken',
    CARD: 'cardToken',
  },
  mainnet: {
    DAI: 'daiToken',
    CARD: 'cardToken',
  },
  sokol: {
    DAI: 'daiCpxd',
    CARD: 'cardCpxd',
  },
  xdai: {
    'DAI.CPXD': 'daiCpxd',
    'CARD.CPXD': 'cardCpxd',
  },
};

export function isBridgedTokenSymbol(
  symbol: TokenSymbol
): symbol is BridgedTokenSymbol {
  return bridgedSymbols.includes(symbol as BridgedTokenSymbol);
}

export class TokenContractInfo {
  symbol: TokenSymbol;
  address: ChainAddress;
  abi = ERC20ABI as AbiItem[];

  constructor(symbol: TokenSymbol, network: NetworkSymbol) {
    this.symbol = symbol;
    this.address = getAddressByNetwork(
      contractNames[network][this.symbol] as AddressKeys,
      network
    );
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
  'CARD.CPXD': {
    name: 'Card',
    symbol: 'CARD.CPXD',
    description: '',
    icon: 'card-token',
  },
  'DAI.CPXD': {
    name: 'Dai',
    symbol: 'DAI.CPXD',
    description: '',
    icon: 'dai-token',
  },
};

export class TokenDisplayInfo<T extends TokenSymbol> implements DisplayInfo {
  name: string;
  symbol: T;
  description: string;
  icon: string;

  constructor(symbol: T) {
    this.symbol = symbol;
    let displayInfo = _tokenDisplayInfoMap[symbol];
    this.name = displayInfo.name!;
    this.description = displayInfo.description!;
    this.icon = displayInfo.icon;
  }

  static iconFor(symbol: string) {
    switch (symbol) {
      case 'ETH':
        return _tokenDisplayInfoMap['ETH'].icon;
      case 'DAI':
      case 'DAI.CPXD':
      case 'XDAI':
        return _tokenDisplayInfoMap['DAI'].icon;
      case 'CARD':
      case 'CARD.CPXD':
        return _tokenDisplayInfoMap['CARD'].icon;
      default:
        return undefined;
    }
  }
}

export class TokenBalance<T extends TokenSymbol> implements DisplayInfo {
  tokenDisplayInfo: TokenDisplayInfo<T>;
  balance: BN;
  constructor(symbol: T, balance: BN) {
    this.tokenDisplayInfo = new TokenDisplayInfo(symbol);
    this.balance = balance;
  }
  get name() {
    return this.tokenDisplayInfo.name;
  }
  get symbol() {
    return this.tokenDisplayInfo.symbol;
  }
  get description() {
    return this.tokenDisplayInfo.description;
  }
  get icon() {
    return this.tokenDisplayInfo.icon;
  }
}
