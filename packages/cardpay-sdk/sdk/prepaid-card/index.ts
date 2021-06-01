/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';

import v0_2_0 from './v0.2.0';
import v0_3_0 from './v0.3.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type PrepaidCard = v0_2_0 | v0_3_0;

export const prepaidCardMeta = {
  apiVersions: { v0_2_0, v0_3_0 },
  contractName: 'prepaidCardManager',
} as ContractMeta;
