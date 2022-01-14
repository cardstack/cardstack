import { ContractMeta } from '../version-resolver';

import v0_8_7 from './v0.8.7';

export type { RewardProgramInfo } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RewardManager = v0_8_7;

export const rewardManagerMeta = {
  apiVersions: { v0_8_7 },
  contractName: 'rewardManager',
} as ContractMeta;
