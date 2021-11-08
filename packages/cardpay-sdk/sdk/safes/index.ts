import { ContractMeta } from '../version-resolver';
import v0_8_0 from './v0.8.0';
import v0_8_4 from './v0.8.4';
import v0_8_5 from './v0.8.5';

export { Safe, DepotSafe, MerchantSafe, ExternalSafe, PrepaidCardSafe, TokenInfo, viewSafe } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type Safes = v0_8_5;

export const safesMeta = {
  apiVersions: { v0_8_0, v0_8_4, v0_8_5 },
  contractName: 'prepaidCardManager', // we use the prepaid card manager contract when loading safes
} as ContractMeta;
