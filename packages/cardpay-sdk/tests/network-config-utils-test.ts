import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { HubConfigResponse } from '../sdk/hub-config';
import { getWeb3ConfigByNetwork } from '../sdk/network-config-utils';

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
  it('should return empty for non-supported network', () => {
    const config = getWeb3ConfigByNetwork(mockedConfig, 'foo');

    chai.expect(config).to.deep.eq({ rpcNodeWssUrl: '', rpcNodeHttpsUrl: '' });
  });
});
