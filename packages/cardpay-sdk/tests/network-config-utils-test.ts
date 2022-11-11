import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import fetch from 'node-fetch';

if (!globalThis.fetch) {
  //@ts-ignore polyfilling fetch
  globalThis.fetch = fetch;
}

import { HubConfigResponse } from '../sdk/hub-config';
import { getWeb3ConfigByNetwork, isSupportedChain, fetchSupportedGasTokens } from '../sdk/network-config-utils';

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

describe('fetchSupportedGasTokens', () => {
  const server = setupServer(
    // NOT "/user", nothing to be relative to!
    rest.get('https://relay.cardstack.com/api/v1/tokens', (_req, res, ctx) => {
      return res(
        ctx.json({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              address: '0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3',
              logoUri:
                'https://gnosis-safe-token-logos.s3.amazonaws.com/0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3.png',
              default: true,
              name: 'CARD Token',
              symbol: 'CARD.CPXD',
              description: '',
              decimals: 18,
              websiteUri: '',
              gas: true,
            },
            {
              address: '0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE',
              logoUri:
                'https://gnosis-safe-token-logos.s3.amazonaws.com/0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE.png',
              default: true,
              name: 'DAI Token',
              symbol: 'DAI.CPXD',
              description: '',
              decimals: 18,
              websiteUri: '',
              gas: true,
            },
          ],
        })
      );
    })
  );

  before(() => {
    server.listen();
  });

  after(() => {
    server.close();
  });

  it('retrieves gas tokens from the relay server', async () => {
    let result = await fetchSupportedGasTokens('gnosis');
    chai.expect(result.length).to.eq(2);
    chai.expect(result[0].symbol).to.eq('CARD.CPXD');
    chai.expect(result[1].symbol).to.eq('DAI.CPXD');
  });
});
