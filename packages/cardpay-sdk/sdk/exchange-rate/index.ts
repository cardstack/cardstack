/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import v0_3_0 from './v0.3.0';
import v0_4_0 from './v0.4.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type ExchangeRate = v0_3_0 | v0_4_0;

export const exchangeRateMeta = {
  apiVersions: { v0_3_0, v0_4_0 },
  contractName: 'revenuePool',
} as ContractMeta;
