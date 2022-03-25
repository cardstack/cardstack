import config from '../../config/environment';
import { Layer2NetworkSymbol, TestLayer2NetworkSymbol } from './types';

type Layer2NetworkCopywriting = {
  fullName: string;
  shortName: string;
  conversationalName: string;
  nativeTokenSymbol: string;
  daiToken: 'DAI' | 'DAI.CPXD';
};

export type NetworkCopywriting = Layer2NetworkCopywriting;

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
  layer2: Layer2NetworkCopywriting;
} = {
  layer2: layer2NetworkDisplayInfo['test-layer2'],
};

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
  ...layer2NetworkDisplayInfo,
};

export { currentNetworkDisplayInfo };
