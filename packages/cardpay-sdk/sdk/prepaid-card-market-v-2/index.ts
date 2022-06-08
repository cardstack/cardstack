import { ContractMeta } from '../version-resolver';

import v0_9_0 from './v0.9.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type PrepaidCardMarketV2 = v0_9_0;

export const prepaidCardMarketV2Meta = {
  apiVersions: { v0_9_0 },
  contractName: 'prepaidCardMarketV2',
} as ContractMeta;
