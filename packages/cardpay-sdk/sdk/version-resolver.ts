import Web3 from 'web3';
import { AddressKeys, getAddress, protocolVersions } from '../contracts/addresses';
import { AbiItem } from 'web3-utils';
import { satisfies } from 'semver';
import mapKeys from 'lodash/mapKeys';
import { LayerTwoOracle, layerTwoOracleMeta } from './layer-two-oracle';
import Safes from './safes';
import { PrepaidCard, prepaidCardMeta } from './prepaid-card';
import { PrepaidCardMarket, prepaidCardMarketMeta } from './prepaid-card-market';
import Assets from './assets';
import LayerOneOracle from './layer-one-oracle';
import TokenBridgeHomeSide from './token-bridge-home-side';
import TokenBridgeForeignSide from './token-bridge-foreign-side';
import { revenuePoolMeta, RevenuePool } from './revenue-pool';
import { rewardPoolMeta, RewardPool } from './reward-pool';
import { rewardManagerMeta, RewardManager } from './reward-manager';
import HubAuth from './hub-auth';

export type SDK =
  | 'Assets'
  | 'LayerOneOracle'
  | 'LayerTwoOracle'
  | 'PrepaidCard'
  | 'PrepaidCardMarket'
  | 'RevenuePool'
  | 'Safes'
  | 'HubAuth'
  | 'TokenBridgeHomeSide'
  | 'TokenBridgeForeignSide'
  | 'RewardPool'
  | 'RewardManager';

export type MapReturnType<T> = T extends 'Assets'
  ? Assets
  : T extends 'HubAuth'
  ? HubAuth
  : T extends 'LayerOneOracle'
  ? LayerOneOracle
  : T extends 'LayerTwoOracle'
  ? LayerTwoOracle
  : T extends 'PrepaidCard'
  ? PrepaidCard
  : T extends 'PrepaidCardMarket'
  ? PrepaidCardMarket
  : T extends 'RevenuePool'
  ? RevenuePool
  : T extends 'RewardPool'
  ? RewardPool
  : T extends 'RewardManager'
  ? RewardManager
  : T extends 'Safes'
  ? Safes
  : T extends 'TokenBridgeHomeSide'
  ? TokenBridgeHomeSide
  : T extends 'TokenBridgeForeignSide'
  ? TokenBridgeForeignSide
  : never;
export interface ContractMeta {
  apiVersions: Record<string, any>;
  contractName: AddressKeys;
}

const cardPayVersionABI: AbiItem[] = [
  {
    constant: true,
    inputs: [],
    name: 'cardpayVersion',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'pure',
    type: 'function',
  },
];
const VersionManagerABI: AbiItem[] = [
  {
    constant: true,
    inputs: [],
    name: 'version',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

export async function getABI(contractName: string, web3: Web3): Promise<AbiItem[]> {
  let versionManager = new web3.eth.Contract(VersionManagerABI, await getAddress('versionManager', web3));
  let protocolVersion = await versionManager.methods.version().call();
  let versionMap: { [version: string]: AbiItem[] } = {};
  for (let version of protocolVersions) {
    // we have to exclude .d.ts files because webpack tries to build
    // these for the dynamic import case.
    versionMap[version.replace('v', '')] = (
      await import(
        /* webpackExclude: /\.d\.ts$/ */
        `../contracts/abi/${version}/${contractName}.ts`
      )
    ).default;
  }
  let abi = getAPIVersion(versionMap, protocolVersion);
  return abi;
}

export async function getSDK<T extends SDK>(sdk: T, ...args: any[]): Promise<MapReturnType<T>> {
  let [web3] = args;
  let apiClass;
  switch (sdk) {
    case 'Assets':
      apiClass = Assets;
      break;
    case 'HubAuth':
      apiClass = HubAuth;
      break;
    case 'LayerOneOracle':
      apiClass = LayerOneOracle;
      break;
    case 'LayerTwoOracle':
      apiClass = await resolveApiVersion(layerTwoOracleMeta, web3);
      break;
    case 'PrepaidCard':
      apiClass = await resolveApiVersion(prepaidCardMeta, web3);
      break;
    case 'PrepaidCardMarket':
      apiClass = await resolveApiVersion(prepaidCardMarketMeta, web3);
      break;
    case 'RevenuePool':
      apiClass = await resolveApiVersion(revenuePoolMeta, web3);
      break;
    case 'RewardPool':
      apiClass = await resolveApiVersion(rewardPoolMeta, web3);
      break;
    case 'RewardManager':
      apiClass = await resolveApiVersion(rewardManagerMeta, web3);
      break;
    case 'Safes':
      apiClass = Safes;
      break;
    case 'TokenBridgeForeignSide':
      apiClass = TokenBridgeForeignSide;
      break;
    case 'TokenBridgeHomeSide':
      apiClass = TokenBridgeHomeSide;
      break;
    default:
      assertNever(sdk as never);
  }
  return new apiClass(...args);
}

async function resolveApiVersion(meta: ContractMeta, web3: Web3) {
  let contract = new web3.eth.Contract(cardPayVersionABI, await getAddress(meta.contractName, web3));
  let protocolVersion = await contract.methods.cardpayVersion().call();
  let versionMap = mapKeys(meta.apiVersions, (_, key) => key.replace('v', '').replace(/_/g, '.'));
  let apiClass = getAPIVersion(versionMap, protocolVersion);
  return apiClass;
}

interface APIVersionMap<T> {
  [version: string]: T;
}

function getAPIVersion<T>(apiVersionMap: APIVersionMap<T>, protocolVersion: string): T {
  let availableApiVersions = Object.keys(apiVersionMap).sort().reverse();
  if (protocolVersion === 'any') {
    return apiVersionMap[availableApiVersions[0]];
  }
  let satisfyingApiVersion: string | undefined;
  for (let possibleApiVersion of availableApiVersions) {
    // we'll use the ~ Tilde Range comparator which will permit patch version
    // for previous patches with the same minor, but not permit previous minors.
    // This means that we need an explicit API version for all minor versions of
    // the cardpay protocol. For patch versions, it's up to use if we want a
    // specific API version for a patch, otherwise the previous most recent
    // patch version of the API will be used. This will allow us to build API's
    // for not yet deployed contracts, where the SDK will switch to the future
    // version of the API as soon as the on-chain protocol version updates.
    // https://www.npmjs.com/package/semver
    if (satisfies(protocolVersion, `~${possibleApiVersion}`)) {
      satisfyingApiVersion = possibleApiVersion;
      break;
    }
  }

  if (!satisfyingApiVersion) {
    throw new Error(
      `Could not find a version of the API that satisfies cardpay protocol version ${protocolVersion} for PrepaidCard`
    );
  }

  return apiVersionMap[satisfyingApiVersion];
}

function assertNever(_value: never): never {
  throw new Error(`not never`);
}
