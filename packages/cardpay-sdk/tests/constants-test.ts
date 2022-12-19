import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Web3 from 'web3';
import JsonRpcProvider from '../providers/json-rpc-provider';
import {
  networkIds,
  networks,
  getConstantByNetwork,
  getConstant,
  supportedChainsArray,
  schedulerSupportedChainsArray,
} from '../sdk/constants';

chai.use(chaiAsPromised);

describe('Network constants', () => {
  it('should return an object with network names as key and chainId as value', () => {
    chai.expect(networkIds).to.deep.eq({
      sokol: 77,
      kovan: 42,
      goerli: 5,
      polygon: 137,
      mainnet: 1,
      gnosis: 100,
    });
  });
  it('should return an object with network chainId as keys and network name as value', () => {
    chai.expect(networks).to.deep.eq({
      77: 'sokol',
      42: 'kovan',
      5: 'goerli',
      137: 'polygon',
      1: 'mainnet',
      100: 'gnosis',
    });
  });
  it('should return all supported networks in an array', () => {
    chai.expect(supportedChainsArray).to.eql(['mainnet', 'goerli', 'gnosis', 'sokol', 'polygon', 'mumbai']);
  });
  it('should return all scheduler supported networks in an array', () => {
    chai.expect(schedulerSupportedChainsArray).to.eql(['mainnet', 'goerli', 'polygon']);
  });

  describe('getConstantByNetwork', () => {
    it('should return ETH for mainnet`s nativeTokenSymbol', () => {
      const mainnetNativeTokenSymbol = getConstantByNetwork('nativeTokenSymbol', 'mainnet');

      chai.expect(mainnetNativeTokenSymbol).to.eq('ETH');
    });
    it('should throw an error if constant does not exist for network', () => {
      chai
        // @ts-expect-error bridgedDaiTokenSymbol doesn't exist on polygon and ts knows is, but we want to force to test it
        .expect(() => getConstantByNetwork('bridgedDaiTokenSymbol', 'polygon'))
        .to.throw(`Don't know about the constant 'bridgedDaiTokenSymbol' for network polygon`);
    });
  });

  describe('getConstant', () => {
    it('should return chainId as 1 for mainnet using getConstant with string', async () => {
      const mainnetChainId = await getConstant('chainId', 'mainnet');

      chai.expect(mainnetChainId).to.eq(1);
    });
    it('should return chainId as 1 for mainnet using getConstant with web3Provider', async () => {
      const mockedWeb3 = {
        eth: {
          net: { getId: async () => 1 },
        },
      } as Web3;

      const mainnetChainId = await getConstant('chainId', mockedWeb3);

      chai.expect(mainnetChainId).to.eq(1);
    });
    it('should return chainId as 1 for mainnet using getConstant with JsonRpcProvider', async () => {
      const instance = Object.create(JsonRpcProvider.prototype);

      const mockedJsonRpc = Object.assign(instance, {
        getNetwork: async () => ({ chainId: 1 }),
      });

      const mainnetChainId = await getConstant('chainId', mockedJsonRpc);

      chai.expect(mainnetChainId).to.eq(1);
    });
    it('should throw an error if constant does not exist for network', async () => {
      await chai
        .expect(getConstant('bridgedDaiTokenSymbol', 'mainnet'))
        .to.be.rejectedWith(`Don't know about the constant 'bridgedDaiTokenSymbol' for network mainnet`);
    });
  });
});
