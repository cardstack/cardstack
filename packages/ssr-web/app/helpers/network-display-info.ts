import { helper } from '@ember/component/helper';
import {
  currentNetworkDisplayInfo,
  NetworkCopywriting,
} from '../utils/web3-strategies/network-display-info';

export function networkDisplayInfo(
  [layer, key]: [
    keyof typeof currentNetworkDisplayInfo,
    // this typing is not correct. it should have accommodations for the 2 different network copywriting types
    // but i'm not very sure how to do this
    keyof NetworkCopywriting
  ] /*, hash*/
) {
  let networkInfo = currentNetworkDisplayInfo[layer];
  if (!networkInfo) {
    throw new Error('Missing network info in network-display-info helper');
  }
  let result = networkInfo[key];

  if (!result) {
    throw new Error(
      `Could not find value for "${layer}.${key}" in network-display-info helper`
    );
  }
  return result;
}

export default helper(
  // hack to make sure helper stays happy regardless of typing
  // should remove this as templates get more type safety
  networkDisplayInfo as unknown as (params: any[], has: any) => string
);
