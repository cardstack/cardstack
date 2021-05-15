import Web3 from 'web3';
import { networkName } from '../sdk/utils';

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
    prepaidCardManager: '0x4f40a6eD9CAE27Dc34b9bf733DBe062854815c8F',
    revenuePool: '0xd44ff7a460A589bDc61Ab4e2642846ab8996c909',
    bridgeUtils: '0xB5a5236e71b33f1F327302ec49d8729CbB9E209F',
    oracles: {
      DAI: '0x42c9555F568D5b8898c78260dB26087549Ce98A9', // eslint-disable-line @typescript-eslint/naming-convention
      CARD: '0xDefaB8C99e3259d8088DbB73Ab116156a3EBc747', // eslint-disable-line @typescript-eslint/naming-convention
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
