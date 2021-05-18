export type TokenSymbol = 'DAI' | 'CARD' | 'ETH';

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
