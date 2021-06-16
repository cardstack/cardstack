/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';

import v0_5_5 from './v0.5.5';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type PrepaidCard = v0_5_5;

export const prepaidCardMeta = {
  apiVersions: { v0_5_5 },
  contractName: 'prepaidCardManager',
} as ContractMeta;
