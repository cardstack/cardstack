/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';

import v0_6_3 from './v0.6.3';
import v0_7_0 from './v0.7.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RevenuePool = v0_7_0;

export const revenuePoolMeta = {
  apiVersions: { v0_6_3, v0_7_0 },
  contractName: 'revenuePool',
} as ContractMeta;
