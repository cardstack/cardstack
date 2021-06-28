import { helper } from '@ember/component/helper';
import {
  currentNetworkDisplayInfo,
  Layer,
  NetworkCopywriting,
} from '../utils/web3-strategies/network-display-info';

export function networkDisplayInfo(
  [layer, key]: [Layer, keyof NetworkCopywriting] /*, hash*/
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
  (networkDisplayInfo as unknown) as (params: any[], has: any) => string
);
