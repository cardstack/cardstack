/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';

import v0_6_1 from './v0.6.1';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type PrepaidCard = v0_6_1;

export const prepaidCardMeta = {
  apiVersions: { v0_6_1 },
  contractName: 'prepaidCardManager',
} as ContractMeta;
