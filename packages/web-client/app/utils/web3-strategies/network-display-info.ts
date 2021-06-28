import config from '../../config/environment';
import { NetworkSymbol } from './types';

type TestNetworkSymbol = 'test-layer1' | 'test-layer2';

type NetworkCopywriting = {
  fullName: string;
  shortName: string;
  networkType: 'testnet' | 'mainnet';
};

export let networkDisplayInfo: Record<
  NetworkSymbol | TestNetworkSymbol,
  NetworkCopywriting
> = {
  mainnet: {
    fullName: 'Ethereum mainnet',
    shortName: 'Ethereum',
    networkType: 'mainnet',
  },
  xdai: {
    fullName: 'xDai chain',
    shortName: 'xDai',
    networkType: 'mainnet',
  },
  kovan: {
    fullName: 'Kovan testnet',
    shortName: 'Kovan',
    networkType: 'testnet',
  },
  sokol: {
    fullName: 'Sokol testnet',
    shortName: 'Sokol',
    networkType: 'testnet',
  },
  'test-layer1': {
    fullName: 'L1 test chain',
    shortName: 'L1',
    networkType: 'testnet',
  },
  'test-layer2': {
    fullName: 'L2 test chain',
    shortName: 'L2',
    networkType: 'testnet',
  },
};

let currentNetworkDisplayInfo: Record<
  'layer1' | 'layer2',
  NetworkCopywriting
> = {
  layer1: networkDisplayInfo['test-layer1'],
  layer2: networkDisplayInfo['test-layer2'],
};

switch (config.chains.layer1) {
  case 'test': {
    currentNetworkDisplayInfo.layer1 = networkDisplayInfo['test-layer1'];
    break;
  }
  case 'keth': {
    currentNetworkDisplayInfo.layer1 = networkDisplayInfo.kovan;
    break;
  }
  case 'eth': {
    currentNetworkDisplayInfo.layer1 = networkDisplayInfo.mainnet;
    break;
  }
  default:
    throw new Error('Unrecognised layer 1 network, failed to get copywriting');
}

switch (config.chains.layer2) {
  case 'test': {
    currentNetworkDisplayInfo.layer2 = networkDisplayInfo['test-layer2'];
    break;
  }
  case 'sokol': {
    currentNetworkDisplayInfo.layer2 = networkDisplayInfo.sokol;
    break;
  }
  case 'xdai': {
    currentNetworkDisplayInfo.layer2 = networkDisplayInfo.xdai;
    break;
  }
  default:
    throw new Error('Unrecognised layer 1 network, failed to get copywriting');
}

export { currentNetworkDisplayInfo };
