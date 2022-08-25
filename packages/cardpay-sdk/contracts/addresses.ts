import Web3 from 'web3';
import { networkName } from '../sdk/utils/general-utils';

// In order to prevent ts linting from causing false positive errors, we create
// this silly consumption of the ABI's. The ABI's are indeed consumed, however,
// we consume them outside of ts due to the way the codegen operates for the
// subgraph assembly script.
import PayMerchantHandlerABI from './abi/v0.9.0/pay-merchant-handler';
import RegisterMerchantHandlerABI from './abi/v0.9.0/register-merchant-handler';
import TransferPrepaidCardHandlerABI from './abi/v0.9.0/transfer-prepaid-card-handler';
import SplitPrepaidCardHandlerABI from './abi/v0.9.0/split-prepaid-card-handler';
import SpendABI from './abi/v0.9.0/spend';
import MerchantManagerABI from './abi/v0.9.0/merchant-manager';
import DeprecatedMerchantManagerABI_0_6_7 from './abi/v0.9.0/deprecated-merchant-manager-0_6_7';
import RegisterRewardProgramHandlerABI from './abi/v0.9.0/register-reward-program-handler';
import RegisterRewardeeHandlerABI from './abi/v0.9.0/register-rewardee-handler';
import SupplierManagerABI from './abi/v0.9.0/supplier-manager';

export const protocolVersions = ['v0.9.0', 'v0.8.7'];

function consumeModule(_module: any) {}
consumeModule(PayMerchantHandlerABI);
consumeModule(RegisterMerchantHandlerABI);
consumeModule(TransferPrepaidCardHandlerABI);
consumeModule(SplitPrepaidCardHandlerABI);
consumeModule(SpendABI);
consumeModule(MerchantManagerABI);
// we include this because we are still interested in indexing events from this contract
consumeModule(DeprecatedMerchantManagerABI_0_6_7);
consumeModule(RegisterRewardProgramHandlerABI);
consumeModule(RegisterRewardeeHandlerABI);
consumeModule(SupplierManagerABI);

const KOVAN = {
  cardToken: '0x17d030616A9879C1Bc7e8764E9D80Ec289d4C7AE',
  daiToken: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
  foreignBridge: '0x97bb40db0fb70eeb4e2121b6d708bd91ec4d1a43',
  foreignAMB: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
  chainlinkEthToUsd: '0x9326BFA02ADD2366b30bacB125260Af641031331',
};
const SOKOL = {
  gnosisProxyFactory_v1_2: '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B',
  gnosisProxyFactory_v1_3: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2',
  homeBridge: '0xf9906aD189CC61d0158Cbc770cFB726a084bc6e0',
  homeAMB: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
  daiCpxd: '0x8F4fdA26e5039eb0bf5dA90c3531AeB91256b56b',
  cardCpxd: '0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f',
  prepaidCardManager: '0xB4D65773A070B776678dc8467EE34657CAeB7b42',
  prepaidCardMarket: '0x065e41F3c3Dd037f15B0a5C439c8426d37FBD8DE',
  prepaidCardMarketV2: '0x49733831b9d3C1C80827ef80a289A166A788aF17',
  revenuePool: '0xE19Bc7b91868197FABBcDc56A9CFB883354C58E8',
  bridgeUtils: '0x3BBAD838bd46692583CF811884d3CDcD7cb65045',
  exchange: '0x67F9078265516B3e2eC30d984a263f7764043050',
  relay: '0xD7182E380b7dFa33C186358De7E1E5d0950fCAE7',
  cardstackIssuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
  wyreIssuer: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
  payMerchantHandler: '0x5A293C9511B10E2A9E47Fbfd72156f150161C976',
  registerMerchantHandler: '0xC76A2199810e3fd968C5F145ceeE51B555cC4C1f',
  splitPrepaidCardHandler: '0x8d613087bC3011A99d05b85E5EEaE228CcB85d3A',
  transferPrepaidCardHandler: '0xc11Dcc91f463a67CddB02eb36a759EcbaE2e72FB',
  supplierManager: '0x55Cc56912925DFB674Ad943A03505702501Dc4bD',
  merchantManager: '0xB272cD66d1EBd4515632A594Ef1B318Dd3496a5F',
  spend: '0xD73aa23EB8C41352cFb0cfa895DC2065faC0c715',
  actionDispatcher: '0xe05b6e545a34E652666591BA504ec7E586bd834b',
  uniswapV2Router: '0xd57B4D7B7FED6b47492A362e113e26F9804DbCc6', // This is the UniswapV2Router02
  uniswapV2Factory: '0x6b67f08F08B715B162aa09239488318A660F24BF',
  rewardPool: '0xcF8852D1aD746077aa4C31B423FdaE5494dbb57A',
  rewardManager: '0xC29EfEa853fb7c781488c70aF9135c853d809147',
  registerRewardProgramHandler: '0x6894b471D980BB13b07490292Fa32D7789E3a677',
  registerRewardeeHandler: '0x29Dbe5ee9783009A5A38211F3094f83d39650FDB',
  versionManager: '0x2B3711533c8E0f0d9cB827EC292dB58D2a9B1dA0',
  deprecatedMerchantManager_v0_6_7: '0xA113ECa0Af275e1906d1fe1B7Bef1dDB033113E2',
  oracles: {
    'DAI.CPXD': '0x01264C442aC3A70953509eed0d475a9c1182307f',
    'CARD.CPXD': '0x0631326B1AEA3f7B864b5Fc9f1C5e025B8a2945F',
    DAI: '0x01264C442aC3A70953509eed0d475a9c1182307f',
    CARD: '0x0631326B1AEA3f7B864b5Fc9f1C5e025B8a2945F',
  },
};

const MAINNET = {
  cardToken: '0x954b890704693af242613edEf1B603825afcD708',
  daiToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  foreignBridge: '0x95d4FAe56F49c2FE6700A7135B6fb7a5aBA5a450',
  foreignAMB: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
  chainlinkEthToUsd: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
};
const GNOSIS = {
  gnosisProxyFactory_v1_2: '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B',
  gnosisProxyFactory_v1_3: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2',
  homeBridge: '0xd1e46b8a371AF04Ce74c993B325b844ef0f48b16',
  homeAMB: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59',
  daiCpxd: '0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE',
  cardCpxd: '0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3',
  prepaidCardManager: '0x15a4Cc5b3CfeBe900e5F514348bC077Eb883224D',
  prepaidCardMarket: '0x20f4251776e776D138967Ad36a3F5d0c6de3EB09',
  prepaidCardMarketV2: '0x8897600115FE944FA8aC78254E1A799698265ddc',
  revenuePool: '0xE097ec255eA9fE4e199E920E105b0f61d6e09C34',
  bridgeUtils: '0xa79206F956461e053DbCF33ADDFa77553Df58D7F',
  exchange: '0x1c5B87A6905327D2370fA57C80667D432926ABA1',
  relay: '0x846fcb74913277AF31FF535cC88bfcC62f64346A',
  cardstackIssuer: '0x3af4fF276c3236Aa5d8EBf98f56a3C64C47d9743',
  wyreIssuer: '0x60DE57A12Ccc6b8712ea8aBbC29Fe03E0718F885',
  payMerchantHandler: '0xdDc6709482ee4072D562C4a9f04Fc6E3249b785e',
  registerMerchantHandler: '0x4101A6C673cBA6afDB2Ef082Cb578b64f81aB3D1',
  splitPrepaidCardHandler: '0x0672c77D9a9C8D81D8082a1fB925fE44f475e600',
  transferPrepaidCardHandler: '0x60d6c7bE551C5D399247C6683f93CC37cf06a4aB',
  supplierManager: '0xf2380376aBFEE5234bb46d8A919D42eE1A395aF3',
  merchantManager: '0x6b78d02cd036c0Deb67840bE9B151C1b9903c028',
  spend: '0xc0247D53Ce3C6abB39b67856eDEfF79b767dB93c',
  actionDispatcher: '0x3cC7DeB8dE522E2176e8c599FaAf7503d0c78AE9',
  uniswapV2Router: '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77', // This is the UniswapV2Router02
  uniswapV2Factory: '0xA818b4F111Ccac7AA31D0BCc0806d64F2E0737D7',
  rewardPool: '0x340EB99eB9aC7DB3a3eb68dB76c6F62738DB656a',
  rewardManager: '0xDbAe2bC81bFa4e46df43a34403aAcde5FFdB2A9D',
  registerRewardProgramHandler: '0x8e0A60912C56F4436396C636f0ED500ef27af4e0',
  registerRewardeeHandler: '0x198ea3D257715Fb2e9025c061BE96e56AE611A9f',
  versionManager: '0xd900133f96F85939335ADb9786ea9f2e07Bdf8c0',
  deprecatedMerchantManager_v0_6_7: '0x3C29B2A563F4bB9D625175bE823c528A4Ddd1107',
  oracles: {
    'DAI.CPXD': '0x36698BF676c40be119b0Fe4f964f4527943258F2',
    'CARD.CPXD': '0xd570Ed8b313Fe6aEEA4064bd1713b5Cc6d41D3C5',
    DAI: '0x36698BF676c40be119b0Fe4f964f4527943258F2',
    CARD: '0xd570Ed8b313Fe6aEEA4064bd1713b5Cc6d41D3C5',
  },
};
const addresses: {
  [network: string]: {
    [contractName: string]: string | { [tokenName: string]: string };
  };
} = Object.freeze({
  kovan: KOVAN,
  sokol: SOKOL,
  mainnet: MAINNET,
  gnosis: GNOSIS,
  xdai: GNOSIS,
});

export type AddressKeys = keyof typeof SOKOL | keyof typeof KOVAN | keyof typeof MAINNET | keyof typeof GNOSIS;

export default addresses;

export function getAddressByNetwork(contractName: AddressKeys, network: string): string {
  let address = addresses[network][contractName];
  if (!address) {
    throw new Error(`Don't know about the address for '${contractName}' for network ${network}`);
  }
  if (typeof address !== 'string') {
    throw new Error(`'${contractName}' is actually a group oracles. use getOracle() to get an oracle`);
  }
  return address;
}

export async function getAddress(contractName: AddressKeys, web3: Web3): Promise<string> {
  let network = await networkName(web3);
  return getAddressByNetwork(contractName, network);
}

export function getOracleByNetwork(tokenName: string, network: string): string {
  let oracles = addresses[network].oracles;
  if (!oracles) {
    throw new Error(`No oracles have been defined for the network ${network}`);
  }
  if (typeof oracles === 'string') {
    throw new Error(`the addresses entry "oracles" must be a group of oracles for network ${network}`);
  }
  let address = oracles[tokenName];
  if (!address) {
    throw new Error(`No oracle exists for the token '${tokenName}' for the network ${network}`);
  }
  return address;
}

export async function getOracle(tokenName: string, web3: Web3): Promise<string> {
  let network = await networkName(web3);
  return getOracleByNetwork(tokenName, network);
}
