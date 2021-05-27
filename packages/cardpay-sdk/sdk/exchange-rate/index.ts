/* eslint @typescript-eslint/naming-convention: "off" */

import { ContractMeta } from '../version-resolver';
import DefaultRevenuePoolABI from '../../contracts/v0.2.0/abi/revenue-pool';
import v0_2_0 from './v0.2.0';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type ExchangeRate = v0_2_0;

export let exchangeRateMeta = {
  apiVersions: { v0_2_0 },
  contractABI: DefaultRevenuePoolABI,
  contractName: 'revenuepool',
} as ContractMeta;
