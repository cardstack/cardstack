import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { HubConfigResponse } from '../sdk/hub-config';
import { getWeb3ConfigByNetwork, isSupportedChain } from '../sdk/network-config-utils';

chai.use(chaiAsPromised);

const mockedConfig = {
  web3: {
    gnosis: {
      rpcNodeHttpsUrl: 'gnosisHttpsRpc',
      rpcNodeWssUrl: 'gnosisWssRpc',
    },
    ethereum: {
      rpcNodeHttpsUrl: 'ethHttpsRpc',
      rpcNodeWssUrl: 'ethWssRpc',
    },
    polygon: {
      rpcNodeHttpsUrl: 'polygonHttpsssRpc',
      rpcNodeWssUrl: 'polygonWssRpc',
    },
  },
} as HubConfigResponse;

describe('getWeb3ConfigByNetwork', () => {
  describe('network as string', () => {
    it('should return ethereum config for mainnet', () => {
      const config = getWeb3ConfigByNetwork(mockedConfig, 'mainnet');

      chai.expect(config).to.eq(mockedConfig.web3.ethereum);
    });
    it('should return polygon config for mumbai', () => {
      const config = getWeb3ConfigByNetwork(mockedConfig, 'mumbai');

      chai.expect(config).to.eq(mockedConfig.web3.polygon);
    });
    it('should return gnosis config for gnosis', () => {
      const config = getWeb3ConfigByNetwork(mockedConfig, 'gnosis');

      chai.expect(config).to.eq(mockedConfig.web3.gnosis);
    });
    it('should return polygon config for polygon', () => {
      const config = getWeb3ConfigByNetwork(mockedConfig, 'polygon');

      chai.expect(config).to.eq(mockedConfig.web3.polygon);
    });
    it('should throw an error for non-supported network: kovan', () => {
      chai.expect(() => getWeb3ConfigByNetwork(mockedConfig, 'kovan')).to.throw(`Unsupported network: kovan`);
    });
  });

  describe('network as chainID', () => {
    it('should return ethereum config for goerli(5)', () => {
      const config = getWeb3ConfigByNetwork(mockedConfig, 5);

      chai.expect(config).to.eq(mockedConfig.web3.ethereum);
    });

    it('should return gnosis config for sokol(77)', () => {
      const config = getWeb3ConfigByNetwork(mockedConfig, 77);

      chai.expect(config).to.eq(mockedConfig.web3.gnosis);
    });

    it('should throw an error for non-supported network: 2', () => {
      chai.expect(() => getWeb3ConfigByNetwork(mockedConfig, 2)).to.throw(`Unsupported network: 2`);
    });
  });
  describe('network as type', () => {
    it('should return ethereum config for goerli', () => {
      const network = 'goerli' as const;

      const config = getWeb3ConfigByNetwork(mockedConfig, network);

      chai.expect(config).to.eq(mockedConfig.web3.ethereum);
    });
  });
});

describe('isSupportedChain', () => {
  const supportedChainNames = ['mainnet', 'gnosis'];
  const supportedChainIds = [5, 80001];

  const unsupportedChains = ['kovan', 'xdai'];
  const nonExistingChains = ['foo', 'bar'];

  const supportedChainAsType = 'polygon' as const;

  [...supportedChainNames, ...supportedChainIds].forEach((network) => {
    it(`should return true for supported network ${network}`, () => {
      chai.expect(isSupportedChain(network)).to.eq(true);
    });
  });

  [...unsupportedChains, ...nonExistingChains].forEach((network) => {
    it(`should return false for non-supported network ${network}`, () => {
      chai.expect(isSupportedChain(network)).to.eq(false);
    });
  });

  it('should return true for supported polygon network as type', () => {
    chai.expect(isSupportedChain(supportedChainAsType)).to.eq(true);
  });
});
