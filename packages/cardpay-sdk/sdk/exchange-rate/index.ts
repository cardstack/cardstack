/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import v0_5_3 from './v0.5.3';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type ExchangeRate = v0_5_3;

export const exchangeRateMeta = {
  apiVersions: { v0_5_3 },
  contractName: 'revenuePool',
} as ContractMeta;
