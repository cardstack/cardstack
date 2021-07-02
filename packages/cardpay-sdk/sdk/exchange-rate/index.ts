/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import v0_6_2 from './v0.6.2';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type ExchangeRate = v0_6_2;

export const exchangeRateMeta = {
  apiVersions: { v0_6_2 },
  contractName: 'revenuePool',
} as ContractMeta;
