import { TokenDetail } from '@cardstack/cardpay-sdk';

export const exampleGasTokens: TokenDetail[] = [
  {
    name: 'Cardstack',
    logoURI: 'card',
    symbol: 'CARD',
    address: '0x954b890704693af242613edEf1B603825afcD708',
    decimals: 18,
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    symbol: 'USDC',
    logoURI:
      'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    decimals: 6,
  },
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    name: 'WETH',
    symbol: 'WETH',
    logoURI:
      'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    decimals: 18,
  },
  {
    name: 'MASQ',
    symbol: 'MASQ',
    address: '0xee9a352f6aac4af1a5b9f467f6a93e0ffbe9dd35',
    logoURI:
      'https://github.com/MASQ-Project/MASQ-contract/raw/master/MASQ%20Logo%20Blue%20Solo%20Transparent.png',
    decimals: 18,
  },
];
