/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import DefaultPrepaidCardABI from '../../contracts/v0.2.0/abi/prepaid-card-manager';
export { PayMerchantTx } from './base';

import v0_2_0 from './v0.2.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type PrepaidCard = v0_2_0;

export let prepaidCardMeta = {
  apiVersions: { v0_2_0 },
  contractABI: DefaultPrepaidCardABI,
  contractName: 'prepaidCard',
} as ContractMeta;
