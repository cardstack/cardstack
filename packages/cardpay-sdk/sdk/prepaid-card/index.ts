/* eslint @typescript-eslint/naming-convention: "off" */

import Web3 from 'web3';
import mapKeys from 'lodash/mapKeys';
import { AbiItem } from 'web3-utils';
import DefaultPrepaidCardABI from '../../contracts/v0.2.0/abi/prepaid-card-manager';
import { getAddress } from '../../contracts/addresses';
import { getAPIVersion } from '../versions';
export { PayMerchantTx } from './base';

import v0_2_0 from './v0.2.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
type PrepaidCard = v0_2_0;
const apiVersions = {
  v0_2_0,
};

const versionMap = mapKeys(apiVersions, (_, key) => key.replace('v', '').replace('_', '.'));

export default async function getPrepaidCard(web3: Web3): Promise<PrepaidCard> {
  let prepaidCardManager = new web3.eth.Contract(
    DefaultPrepaidCardABI as AbiItem[], // all versions of the ABI contain the cardpayVersion() function
    await getAddress('prepaidCard', web3)
  );
  let protocolVersion = await prepaidCardManager.methods.cardpayVersion().call();
  let api = getAPIVersion(versionMap, protocolVersion);
  return new api(web3);
}
