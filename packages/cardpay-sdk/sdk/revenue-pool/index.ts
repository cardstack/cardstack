import { ContractMeta } from '../version-resolver';

import v0_2_0 from './v.2.0';
import v0_3_0 from './v.3.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RevenuePool = v0_2_0 | v0_3_0;

export const revenuePoolMeta = {
  apiVersions: { v0_2_0, v0_3_0 },
  contractName: 'revenuePool',
} as ContractMeta;
