import { ContractMeta } from '../version-resolver';
import v0_8_0 from './v0.8.0';

export { Safe, DepotSafe, MerchantSafe, ExternalSafe, PrepaidCardSafe, TokenInfo, viewSafe } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type Safes = v0_8_0;

export const safesMeta = {
  apiVersions: { v0_8_0 },
  contractName: 'prepaidCardManager', // we use the prepaid card manager contract when loading safes
} as ContractMeta;
