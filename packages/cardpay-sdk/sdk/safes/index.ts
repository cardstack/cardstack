/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import v0_5_0 from './v0.5.0';

export { Safe, DepotSafe, MerchantSafe, ExternalSafe, PrepaidCardSafe, TokenInfo } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type Safes = v0_5_0;

export const safesMeta = {
  apiVersions: { v0_5_0 },
  contractName: 'prepaidCardManager', // we use the prepaid card manager contract when loading safes
} as ContractMeta;
