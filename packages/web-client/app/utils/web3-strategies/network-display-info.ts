import config from '../../config/environment';
import {
  Layer1NetworkSymbol,
  TestLayer1NetworkSymbol,
  Layer2NetworkSymbol,
  TestLayer2NetworkSymbol,
} from './types';

type Layer1NetworkCopywriting = {
  fullName: string;
  shortName: string;
  conversationalName: string;
  nativeTokenSymbol: string;
};
type Layer2NetworkCopywriting = {
  fullName: string;
  shortName: string;
  conversationalName: string;
  nativeTokenSymbol: string;
  daiToken: 'DAI' | 'DAI.CPXD';
};

export type NetworkCopywriting =
  | Layer1NetworkCopywriting
  | Layer2NetworkCopywriting;

let layer1NetworkDisplayInfo: Record<
  Layer1NetworkSymbol | TestLayer1NetworkSymbol,
  Layer1NetworkCopywriting
> = {
  mainnet: {
    fullName: 'Ethereum mainnet',
    shortName: 'Ethereum',
    conversationalName: 'mainnet',
    nativeTokenSymbol: 'ETH',
  },
  kovan: {
    fullName: 'Kovan testnet',
    shortName: 'Kovan',
    conversationalName: 'Kovan',
    nativeTokenSymbol: 'ETH',
  },
  'test-layer1': {
    fullName: 'L1 test chain',
    shortName: 'L1',
    conversationalName: 'L1 test chain',
    nativeTokenSymbol: 'ETH',
  },
};
let layer2NetworkDisplayInfo: Record<
  Layer2NetworkSymbol | TestLayer2NetworkSymbol,
  Layer2NetworkCopywriting
> = {
  xdai: {
    fullName: 'Gnosis Chain',
    shortName: 'Gnosis',
    conversationalName: 'Gnosis Chain',
    nativeTokenSymbol: 'DAI',
    daiToken: 'DAI.CPXD',
  },
  sokol: {
    fullName: 'Sokol testnet',
    shortName: 'Sokol',
    conversationalName: 'Sokol',
    nativeTokenSymbol: 'SPOA',
    daiToken: 'DAI',
  },
  'test-layer2': {
    fullName: 'L2 test chain',
    shortName: 'L2',
    conversationalName: 'L2 test chain',
    nativeTokenSymbol: 'DAI',
    daiToken: 'DAI.CPXD',
  },
};

let currentNetworkDisplayInfo: {
  layer1: Layer1NetworkCopywriting;
  layer2: Layer2NetworkCopywriting;
} = {
  layer1: layer1NetworkDisplayInfo['test-layer1'],
  layer2: layer2NetworkDisplayInfo['test-layer2'],
};

switch (config.chains.layer1) {
  case 'test': {
    currentNetworkDisplayInfo.layer1 = layer1NetworkDisplayInfo['test-layer1'];
    break;
  }
  case 'keth': {
    currentNetworkDisplayInfo.layer1 = layer1NetworkDisplayInfo.kovan;
    break;
  }
  case 'eth': {
    currentNetworkDisplayInfo.layer1 = layer1NetworkDisplayInfo.mainnet;
    break;
  }
  default:
    throw new Error('Unrecognised layer 1 network, failed to get copywriting');
}

switch (config.chains.layer2) {
  case 'test': {
    currentNetworkDisplayInfo.layer2 = layer2NetworkDisplayInfo['test-layer2'];
    break;
  }
  case 'sokol': {
    currentNetworkDisplayInfo.layer2 = layer2NetworkDisplayInfo.sokol;
    break;
  }
  case 'xdai': {
    currentNetworkDisplayInfo.layer2 = layer2NetworkDisplayInfo.xdai;
    break;
  }
  default:
    throw new Error('Unrecognised layer 2 network, failed to get copywriting');
}

export let networkDisplayInfo = {
  ...layer1NetworkDisplayInfo,
  ...layer2NetworkDisplayInfo,
};

export { currentNetworkDisplayInfo };
