import { ContractMeta } from '../version-resolver';

import v0_8_5 from './v0.8.5';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RewardManager = v0_8_5;

export const rewardManagerMeta = {
  apiVersions: { v0_8_5 },
  contractName: 'rewardManager',
} as ContractMeta;
