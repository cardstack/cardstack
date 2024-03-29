import Web3 from 'web3';
import { AddressKeys, getAddress, protocolVersions } from '../contracts/addresses';
import { AbiItem } from 'web3-utils';
import { satisfies } from 'semver';
import mapKeys from 'lodash/mapKeys';
import { LayerTwoOracle, layerTwoOracleMeta } from './layer-two-oracle';
import Safes from './safes';
import { PrepaidCard, prepaidCardMeta } from './prepaid-card';
import { PrepaidCardMarket, prepaidCardMarketMeta } from './prepaid-card-market';
import { PrepaidCardMarketV2, prepaidCardMarketV2Meta } from './prepaid-card-market-v-2';
import Assets, { AssetsEthers } from './assets';
import LayerOneOracle from './layer-one-oracle';
import TokenBridgeHomeSide from './token-bridge-home-side';
import TokenBridgeForeignSide from './token-bridge-foreign-side';
import { revenuePoolMeta, RevenuePool } from './revenue-pool';
import { rewardPoolMeta, RewardPool } from './reward-pool';
import { rewardManagerMeta, RewardManager } from './reward-manager';
import HubAuth from './hub-auth';
import { SUPPORTED_ABIS } from '../generated/supported-abis'; // this file is code-generated during postinstall step and the constant is a property tree of version -> contract name -> contract ABI
import ScheduledPaymentModule from './scheduled-payment-module';
import JsonRpcProvider from '../providers/json-rpc-provider';
import ClaimSettlementModule from './claim-settlement-module';

/**
 * @group SDK
 */
export type SDK =
  | 'Assets'
  | 'LayerOneOracle'
  | 'LayerTwoOracle'
  | 'PrepaidCard'
  | 'PrepaidCardMarket'
  | 'PrepaidCardMarketV2'
  | 'RevenuePool'
  | 'Safes'
  | 'HubAuth'
  | 'TokenBridgeHomeSide'
  | 'TokenBridgeForeignSide'
  | 'RewardPool'
  | 'RewardManager'
  | 'ScheduledPaymentModule'
  | 'ClaimSettlementModule';

/**
 * @group SDK
 */
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
  : T extends 'PrepaidCardMarketV2'
  ? PrepaidCardMarketV2
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
  : T extends 'ScheduledPaymentModule'
  ? ScheduledPaymentModule
  : T extends 'ClaimSettlementModule'
  ? ClaimSettlementModule
  : never;
/**
 * @group SDK
 */
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

/**
 * @group SDK
 */
export async function getABI(contractName: string, web3: Web3): Promise<AbiItem[]> {
  let versionManager = new web3.eth.Contract(VersionManagerABI, await getAddress('versionManager', web3));
  let protocolVersion = await versionManager.methods.version().call();
  let versionMap: { [version: string]: AbiItem[] } = {};
  for (let version of protocolVersions) {
    versionMap[version.replace('v', '')] = SUPPORTED_ABIS[version][contractName];
  }
  let abi = getAPIVersion(versionMap, protocolVersion);
  return abi;
}

/**
 * The cardpay SDK will automatically obtain the latest API version that works with the on-chain contracts. In order to obtain an API you need to leverage the `getSDK()` function and pass to it the API that you wish to work with, as well as any parameters necessary for obtaining an API (usually just an instance of Web3).
 * @returns a promise for the requested API.
 *
 * @example
 * ```ts
 * import { getSDK } from "@cardstack/cardpay-sdk";
 * let safesAPI = await getSDK('Safes', web3);
 * ```
 * @group SDK
 */
export async function getSDK<T extends SDK>(sdk: T, ...args: any[]): Promise<MapReturnType<T>> {
  let [web3OrEthersProvider] = args;
  let apiClass;
  switch (sdk) {
    case 'Assets':
      if (web3OrEthersProvider instanceof JsonRpcProvider) {
        apiClass = AssetsEthers;
      } else {
        apiClass = Assets;
      }
      break;
    case 'HubAuth':
      apiClass = HubAuth;
      break;
    case 'LayerOneOracle':
      apiClass = LayerOneOracle;
      break;
    case 'LayerTwoOracle':
      apiClass = await resolveApiVersion(layerTwoOracleMeta, web3OrEthersProvider);
      break;
    case 'PrepaidCard':
      apiClass = await resolveApiVersion(prepaidCardMeta, web3OrEthersProvider);
      break;
    case 'PrepaidCardMarket':
      apiClass = await resolveApiVersion(prepaidCardMarketMeta, web3OrEthersProvider);
      break;
    case 'PrepaidCardMarketV2':
      apiClass = await resolveApiVersion(prepaidCardMarketV2Meta, web3OrEthersProvider);
      break;
    case 'RevenuePool':
      apiClass = await resolveApiVersion(revenuePoolMeta, web3OrEthersProvider);
      break;
    case 'RewardPool':
      apiClass = await resolveApiVersion(rewardPoolMeta, web3OrEthersProvider);
      break;
    case 'RewardManager':
      apiClass = await resolveApiVersion(rewardManagerMeta, web3OrEthersProvider);
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
    case 'ScheduledPaymentModule':
      apiClass = ScheduledPaymentModule;
      break;
    case 'ClaimSettlementModule':
      apiClass = ClaimSettlementModule;
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
