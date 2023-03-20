import { ContractMeta } from '../version-resolver';

import v0_8_7 from './v0.8.7';
import v0_9_0 from './v0.9.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
/**
 * @hidden
 */
export type LayerTwoOracle = v0_9_0;

export const layerTwoOracleMeta = {
  apiVersions: { v0_8_7, v0_9_0 },
  contractName: 'revenuePool',
} as ContractMeta;
