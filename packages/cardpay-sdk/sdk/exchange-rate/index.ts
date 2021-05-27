/* eslint @typescript-eslint/naming-convention: "off" */

import Web3 from 'web3';
import mapKeys from 'lodash/mapKeys';
import { AbiItem } from 'web3-utils';
import DefaultRevenuePoolABI from '../../contracts/v0.2.0/abi/revenue-pool';
import { getAddress } from '../../contracts/addresses';
import { getAPIVersion } from '../versions';

import v0_2_0 from './v0.2.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
type ExchangeRate = v0_2_0;
const apiVersions = {
  v0_2_0,
};

const versionMap = mapKeys(apiVersions, (_, key) => key.replace('v', '').replace('_', '.'));

export default async function getExchangeRate(web3: Web3): Promise<ExchangeRate> {
  let revenuePool = new web3.eth.Contract(
    DefaultRevenuePoolABI as AbiItem[], // all versions of the ABI contain the cardpayVersion() function
    await getAddress('revenuePool', web3)
  );
  let protocolVersion = await revenuePool.methods.cardpayVersion().call();
  let api = getAPIVersion(versionMap, protocolVersion);
  return new api(web3);
}
