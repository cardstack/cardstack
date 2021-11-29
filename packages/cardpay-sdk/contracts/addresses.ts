import Web3 from 'web3';
import { networkName } from '../sdk/utils/general-utils';

// In order to prevent ts linting from causing false positive errors, we create
// this silly consumption of the ABI's. The ABI's are indeed consumed, however,
// we consume them outside of ts due to the way the codegen operates for the
// subgraph assembly script.
import PayMerchantHandlerABI from './abi/v0.8.6/pay-merchant-handler';
import RegisterMerchantHandlerABI from './abi/v0.8.6/register-merchant-handler';
import TransferPrepaidCardHandlerABI from './abi/v0.8.6/transfer-prepaid-card-handler';
import SplitPrepaidCardHandlerABI from './abi/v0.8.6/split-prepaid-card-handler';
import SpendABI from './abi/v0.8.6/spend';
import MerchantManagerABI from './abi/v0.8.6/merchant-manager';
import DeprecatedMerchantManagerABI_0_6_7 from './abi/v0.8.6/deprecated-merchant-manager-0_6_7';
import RegisterRewardProgramHandlerABI from './abi/v0.8.6/register-reward-program-handler';
import RegisterRewardeeHandlerABI from './abi/v0.8.6/register-rewardee-handler';
import SupplierManagerABI from './abi/v0.8.6/supplier-manager';

export const protocolVersions = ['v0.8.6', 'v0.8.5'];

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
  cardToken: '0xd6E34821F508e4247Db359CFceE0cb5e8050972a',
  daiToken: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
  foreignBridge: '0x366b4cc64D30849568af65522De3a68ea6CC78cE',
  foreignAMB: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
  chainlinkEthToUsd: '0x9326BFA02ADD2366b30bacB125260Af641031331',
};
const SOKOL = {
  gnosisProxyFactory: '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B',
  homeBridge: '0x16a80598DD2f143CFBf091638CE3fB02c9135528',
  homeAMB: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
  daiCpxd: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
  cardCpxd: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
  prepaidCardManager: '0xEba6d63dDf30174B87272D5cF566D63547e60119',
  prepaidCardMarket: '0x959CF9c3f8bDdba69210159c25f77BCE58EADC75',
  revenuePool: '0xfD59940a9789E161217A853F3D78ec619247ADb7',
  bridgeUtils: '0x34e286a943E017b105C48fd78f4A61424b0cc8f7',
  exchange: '0x95C13a7CFf0c12bAD1AAD2e7C962103988bD4444',
  relay: '0xD7182E380b7dFa33C186358De7E1E5d0950fCAE7',
  cardstackIssuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
  wyreIssuer: '0xEdEeb0Ec367CF65Be7efA8340be05170028679aA',
  payMerchantHandler: '0xB2Dc4A31bAdaF8962B882b67958033DCF1FbEE6c',
  registerMerchantHandler: '0xc267d67cDbb5aCC6f477D4eAb173Dcc54F00e762',
  splitPrepaidCardHandler: '0x938533e9533f5F9E67DDC693ffE78710A5C096c2',
  transferPrepaidCardHandler: '0x311529D6DB926441c352725448eeF4A64f71438e',
  supplierManager: '0xBB6BaE445c8E43d929c0EE4C915c8ef002088D25',
  merchantManager: '0xD764e42Af9B63aDb21a79974f80Ed381c79aC90A',
  spend: '0xcd7AB5c678Bc0b90dD6f870B8F214c10A943FC67',
  actionDispatcher: '0xaE5AC3685630b33Ed2677438EEaAe0aD5372c795',
  uniswapV2Router: '0xd57B4D7B7FED6b47492A362e113e26F9804DbCc6', // This is the UniswapV2Router02
  uniswapV2Factory: '0x6b67f08F08B715B162aa09239488318A660F24BF',
  rewardPool: '0x93a2684c14CeeF20fCdE714BDF362dda6A4C9287',
  rewardManager: '0xaC47B293f836F3a64eb4AEF02Cb7d1428dCe815f',
  registerRewardProgramHandler: '0xaF5B2869Be9Eb9c45cc0501F17B145A3229dD2C0',
  registerRewardeeHandler: '0xD46f5eE431eAA309ABeC7a3561E06586450171b0',
  versionManager: '0xBbF3aad37298C997a485E270bD465ec3e6aCD2a7',
  deprecatedMerchantManager_v0_6_7: '0xA113ECa0Af275e1906d1fe1B7Bef1dDB033113E2',
  oracles: {
    'DAI.CPXD': '0x74beF86c9d4a5b96B81D8d8e44157DFd35Eda5fB',
    'CARD.CPXD': '0xb4Fcc975c2b6A57dd5B3d9a3B6b144499f707c7d',
    DAI: '0x74beF86c9d4a5b96B81D8d8e44157DFd35Eda5fB',
    CARD: '0xb4Fcc975c2b6A57dd5B3d9a3B6b144499f707c7d',
  },
  rewardSafeDelegate: '0x4F771D5d4B6DA6be9811EE199D0bb735aB5948a6',
};
const MAINNET = {
  cardToken: '0x954b890704693af242613edEf1B603825afcD708',
  daiToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  foreignBridge: '0x95d4FAe56F49c2FE6700A7135B6fb7a5aBA5a450',
  foreignAMB: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
  chainlinkEthToUsd: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
};
const XDAI = {
  gnosisProxyFactory: '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B',
  homeBridge: '0xd1e46b8a371AF04Ce74c993B325b844ef0f48b16',
  homeAMB: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59',
  daiCpxd: '0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE',
  cardCpxd: '0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3',
  prepaidCardManager: '0x15a4Cc5b3CfeBe900e5F514348bC077Eb883224D',
  prepaidCardMarket: '0x20f4251776e776D138967Ad36a3F5d0c6de3EB09',
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
  rewardPool: '0x86648EbB0de02B9815Bfc5001cEa1Dd35a5A4552',
  rewardManager: '0x3B6bedcA6EC78fCd33aFeB385B192056de639403',
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
  rewardSafeDelegate: '',
};
const addresses: {
  [network: string]: {
    [contractName: string]: string | { [tokenName: string]: string };
  };
} = Object.freeze({
  kovan: KOVAN,
  sokol: SOKOL,
  mainnet: MAINNET,
  xdai: XDAI,
});

export type AddressKeys = keyof typeof SOKOL | keyof typeof KOVAN | keyof typeof MAINNET | keyof typeof XDAI;

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
