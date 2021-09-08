/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import v0_8_0 from './v0.8.0';
import v0_7_0 from './v0.7.0';

export { Safe, DepotSafe, MerchantSafe, ExternalSafe, PrepaidCardSafe, TokenInfo } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type Safes = v0_8_0;

export const safesMeta = {
  apiVersions: { v0_8_0, v0_7_0 },
  contractName: 'prepaidCardManager', // we use the prepaid card manager contract when loading safes
} as ContractMeta;
