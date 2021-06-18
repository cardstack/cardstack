import Web3 from 'web3';
import { networkName } from '../sdk/utils/general-utils';

// TODO remove this after we drop the need for the v0.5.5 abi's (subgraphs)
// consume the v0.5.5 abi's so that lint doesn't yell at us. these are really
// consumed by our subgraphs, but linting seems to not understand that
import BridgeUtilsABI from './abi/v0.5.5/bridge-utils';
import PrepaidCardManagerABI from './abi/v0.5.5/prepaid-card-manager';
import PriceOracleABI from './abi/v0.5.5/price-oracle';
import RevenuePoolABI from './abi/v0.5.5/revenue-pool';
import SpendABI from './abi/v0.5.5/spend';
function doNothing(_stuff: any) {}
doNothing(SpendABI);
doNothing(BridgeUtilsABI);
doNothing(PrepaidCardManagerABI);
doNothing(PriceOracleABI);
doNothing(RevenuePoolABI);

const addresses: {
  [network: string]: {
    [contractName: string]: string | { [tokenName: string]: string };
  };
} = Object.freeze({
  kovan: {
    cardToken: '0xd6E34821F508e4247Db359CFceE0cb5e8050972a',
    daiToken: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
    foreignBridge: '0x366b4cc64D30849568af65522De3a68ea6CC78cE',
  },
  sokol: {
    homeBridge: '0x16a80598DD2f143CFBf091638CE3fB02c9135528',
    daiCpxd: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
    cardCpxd: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
    prepaidCardManager: '0xEba6d63dDf30174B87272D5cF566D63547e60119',
    revenuePool: '0xfD59940a9789E161217A853F3D78ec619247ADb7',
    bridgeUtils: '0x34e286a943E017b105C48fd78f4A61424b0cc8f7',
    exchange: '0x2605718656E317D2347Af082094f239cc7d4D52c',
    payMerchantHandler: '0xB2Dc4A31bAdaF8962B882b67958033DCF1FbEE6c',
    registerMerchantHandler: '0xc267d67cDbb5aCC6f477D4eAb173Dcc54F00e762',
    supplierManager: '0xBB6BaE445c8E43d929c0EE4C915c8ef002088D25',
    merchantManager: '0xA113ECa0Af275e1906d1fe1B7Bef1dDB033113E2',
    spend: '0xcd7AB5c678Bc0b90dD6f870B8F214c10A943FC67',
    oracles: {
      DAI: '0x74beF86c9d4a5b96B81D8d8e44157DFd35Eda5fB', // eslint-disable-line @typescript-eslint/naming-convention
      CARD: '0xb4Fcc975c2b6A57dd5B3d9a3B6b144499f707c7d', // eslint-disable-line @typescript-eslint/naming-convention
    },
  },
  mainnet: {
    cardToken: '0x954b890704693af242613edEf1B603825afcD708',
    daiToken: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  xdai: {},
});

export default addresses;

export function getAddressByNetwork(contractName: string, network: string): string {
  let address = addresses[network][contractName];
  if (!address) {
    throw new Error(`Don't know about the address for '${contractName}' for network ${network}`);
  }
  if (typeof address !== 'string') {
    throw new Error(`'${contractName}' is actually a group oracles. use getOracle() to get an oracle`);
  }
  return address;
}

export async function getAddress(contractName: string, web3: Web3): Promise<string> {
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
