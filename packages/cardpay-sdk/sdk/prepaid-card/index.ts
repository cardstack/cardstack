/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';

import v0_8_0 from './v0.8.0';
import v0_7_0 from './v0.7.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type PrepaidCard = v0_8_0;

export const prepaidCardMeta = {
  apiVersions: { v0_8_0, v0_7_0 },
  contractName: 'prepaidCardManager',
} as ContractMeta;
