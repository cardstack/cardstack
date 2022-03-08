import { MerchantSafe } from '@cardstack/cardpay-sdk';

import { Resolver } from 'did-resolver';
import { getResolver } from '@cardstack/did-resolver';

// created at date affects sorting of safes, making it a constant makes it so safes are by default ordered by the order they're provided
export const DEFAULT_CREATED_AT_DATE = 0;

export const getFilenameFromDid = async (did: string) => {
  let resolver = new Resolver({ ...getResolver() });
  let resolvedDID = await resolver.resolve(did);
  if (!resolvedDID?.didDocument?.alsoKnownAs) {
    throw new Error('Could not resolve DID to filename');
  }
  let didAlsoKnownAs = resolvedDID.didDocument.alsoKnownAs[0];
  return didAlsoKnownAs.split('/')[4].split('.')[0];
};

const defaultMerchantSafe: MerchantSafe = {
  address: 'DEFAULT_MERCHANT_ADDRESS', // should be overwritten in factory
  createdAt: DEFAULT_CREATED_AT_DATE,
  tokens: [],
  owners: ['DEFAULT_MERCHANT_OWNER_ADDRESS'], // should be overwritten in factory
  type: 'merchant',
  accumulatedSpendValue: 0,
  merchant: 'EOA_ADDRESS', // should be overwritten in factory
  infoDID: 'did:cardstack:example-did', // should be overwritten in factory
};
/**
 * Defaults create a freshly created merchant without customization:
 * {
 *   address: 'DEFAULT_MERCHANT_ADDRESS', // should be overwritten in factory
 *   createdAt: DEFAULT_CREATED_AT_DATE,
 *   tokens: [],
 *   owners: ['DEFAULT_MERCHANT_OWNER_ADDRESS'], // should be overwritten in factory
 *   type: 'merchant',
 *   accumulatedSpendValue: 0,
 *   merchant: 'EOA_ADDRESS', // should be overwritten in factory
 * }
 */
export const createMerchantSafe = (
  opts: Partial<MerchantSafe>
): MerchantSafe => ({
  ...defaultMerchantSafe,
  createdAt: DEFAULT_CREATED_AT_DATE,
  ...opts,
  address: opts.address!,
  owners: opts.owners!,
  merchant: opts.merchant!,
});
