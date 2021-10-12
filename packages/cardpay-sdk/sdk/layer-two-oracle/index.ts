import { ContractMeta } from '../version-resolver';
import v0_8_0 from './v0.8.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type LayerTwoOracle = v0_8_0;

export const layerTwoOracleMeta = {
  apiVersions: { v0_8_0 },
  contractName: 'revenuePool',
} as ContractMeta;
