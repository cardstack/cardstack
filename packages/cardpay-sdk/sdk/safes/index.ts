/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import DefaultPrepaidCardABI from '../../contracts/v0.2.0/abi/prepaid-card-manager';
import v0_2_0 from './v0.2.0';

export { Safe, DepotSafe, MerchantSafe, ExternalSafe, PrepaidCardSafe } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type Safes = v0_2_0;

export let safesMeta = {
  apiVersions: { v0_2_0 },
  contractABI: DefaultPrepaidCardABI,
  contractName: 'prepaidCard',
} as ContractMeta;
