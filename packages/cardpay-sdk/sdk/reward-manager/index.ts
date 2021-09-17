/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';

import v0_8_0 from './v0.8.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RewardManager = v0_8_0;

export const rewardManagerMeta = {
  apiVersions: { v0_8_0 },
  contractName: 'rewardManager',
} as ContractMeta;
