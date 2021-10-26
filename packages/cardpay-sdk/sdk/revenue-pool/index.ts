import { ContractMeta } from '../version-resolver';

import v0_8_4 from './v0.8.4';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RevenuePool = v0_8_4;

export const revenuePoolMeta = {
  apiVersions: { v0_8_4 },
  contractName: 'revenuePool',
} as ContractMeta;
