import {
  MerchantSafe,
  PrepaidCardSafe,
  DepotSafe,
} from '@cardstack/cardpay-sdk/sdk/safes';
import { BridgeableSymbol } from '@cardstack/web-client/utils/token';
import { Resolver } from 'did-resolver';
import { encodeDID, getResolver } from '@cardstack/did-resolver';
import Web3 from 'web3';

// The address generation is not for production use. web3 notes the following:
// This package has NOT been audited and might potentially be unsafe.
// Take precautions to clear memory properly, store the private keys safely, and test transaction receiving and sending functionality properly before using in production!
let web3Instance = new Web3();
let generateAddress = () => web3Instance.eth.accounts.create().address;

export const getFilenameFromDid = async (did: string) => {
  let resolver = new Resolver({ ...getResolver() });
  let resolvedDID = await resolver.resolve(did);
  if (!resolvedDID?.didDocument?.alsoKnownAs) {
    throw new Error('Could not resolve DID to filename');
  }
  let didAlsoKnownAs = resolvedDID.didDocument.alsoKnownAs[0];
  return didAlsoKnownAs.split('/')[4].split('.')[0];
};

interface MirageIdentifiableCardCustomization {
  id: string;
  issuerName: string;
  colorScheme: any;
  pattern: any;
}

export const createPrepaidCardCustomization = async (options: {
  issuerName: MirageIdentifiableCardCustomization['issuerName'];
  colorScheme: MirageIdentifiableCardCustomization['colorScheme'];
  pattern: MirageIdentifiableCardCustomization['pattern'];
}): Promise<{
  did: string;
  customization: MirageIdentifiableCardCustomization;
}> => {
  let did = encodeDID({
    type: 'PrepaidCardCustomization',
    version: 10,
  });

  return {
    did,
    customization: {
      ...options,
      id: await getFilenameFromDid(did),
    },
  };
};

/**
 * This is a hardcoded DID for prepaid cards that are newly created via a POST /prepaid-card-customizations request intercepted by mirage
 */
export const defaultCreatedPrepaidCardDID = encodeDID({
  type: 'PrepaidCardCustomization',
  version: 1,
  uniqueId: '75218c05-3899-46d6-b431-e7237ba293ca',
});

/**
 * Note that this function is only assuming use with DAI and CARD
 * and is used mostly for `token.symbol` and `balance`
 */
export const createSafeToken = <T extends BridgeableSymbol>(
  symbol: T,
  balance: string
) => {
  return {
    balance,
    tokenAddress: `${symbol}_ADDRESS`,
    token: {
      symbol: symbol,
      name: symbol,
      decimals: 18,
    },
  };
};

const defaultMerchantSafe: MerchantSafe = {
  address: 'DEFAULT_MERCHANT_ADDRESS', // should be overwritten in factory
  createdAt: Date.now() / 1000,
  tokens: [],
  owners: ['DEFAULT_MERCHANT_OWNER_ADDRESS'], // should be overwritten in factory
  type: 'merchant',
  accumulatedSpendValue: 0,
  merchant: 'EOA_ADDRESS', // should be overwritten in factory
};
/**
 * Defaults create a freshly created merchant without customization:
 * {
 *   address: 'DEFAULT_MERCHANT_ADDRESS', // should be overwritten in factory
 *   createdAt: Date.now() / 1000,
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
  createdAt: Date.now() / 1000,
  ...opts,
  address: opts.address || generateAddress(),
  owners: opts.owners || [generateAddress()],
  merchant: opts.merchant || generateAddress(),
});

const defaultPrepaidCardSafe: PrepaidCardSafe = {
  address: 'DEFAULT_PREPAID_CARD_ADDRESS', // should be overwritten in factory
  owners: ['DEFAULT_PREPAID_CARD_OWNER_ADDRESS'], // should be overwritten in factory
  issuer: 'DEFAULT_PREPAID_CARD_ISSUER_ADDRESS', // should be overwritten in factory
  prepaidCardOwner: 'DEFAULT_PREPAID_CARD_OWNER_ADDRESS', // should be overwritten in factory
  createdAt: Date.now() / 1000,
  tokens: [],
  issuingToken: '0xTOKEN',
  spendFaceValue: 1000,
  type: 'prepaid-card',
  hasBeenUsed: false,
  reloadable: false,
  transferrable: true,
};
/**
 * Defaults create a freshly created prepaid card without customization and 1000 SPEND:
 * ```
 * {
 *   address: 'DEFAULT_PREPAID_CARD_ADDRESS', // should be overwritten in factory
 *   owners: ['DEFAULT_PREPAID_CARD_OWNER_ADDRESS'], // should be overwritten in factory
 *   issuer: 'DEFAULT_PREPAID_CARD_ISSUER_ADDRESS', // should be overwritten in factory
 *   prepaidCardOwner: 'DEFAULT_PREPAID_CARD_OWNER_ADDRESS', // should be overwritten in factory
 *   createdAt: Date.now() / 1000,
 *   tokens: [],
 *   issuingToken: '0xTOKEN',
 *   spendFaceValue: 1000,
 *   type: 'prepaid-card',
 *   hasBeenUsed: false,
 *   reloadable: false,
 *   transferrable: true,
 * };
 * ```
 */
export const createPrepaidCardSafe = (
  opts: Partial<PrepaidCardSafe>
): PrepaidCardSafe => {
  let owners = opts.owners || [generateAddress()];
  return {
    ...defaultPrepaidCardSafe,
    createdAt: Date.now() / 1000,
    ...opts,
    address: opts.address || generateAddress(),
    owners: owners,
    prepaidCardOwner: owners[0],
    issuer: opts.issuer || generateAddress(),
    // Generate addresses here
  };
};

const defaultDepotSafe: DepotSafe = {
  address: 'DEFAULT_DEPOT_ADDRESS', // should be overwritten in factory
  createdAt: Date.now() / 1000,
  tokens: [],
  owners: ['DEFAULT_DEPOT_OWNER_ADDRESS'], // should be overwritten in factory
  type: 'depot',
};
/**
 * Defaults create a freshly created depot:
 * {
 *   address: 'DEFAULT_DEPOT_ADDRESS', // should be overwritten in factory
 *   createdAt: Date.now() / 1000,
 *   tokens: [],
 *   owners: ['DEFAULT_DEPOT_OWNER_ADDRESS'], // should be overwritten in factory
 *   type: 'depot',
 * };
 */
export const createDepotSafe = (opts: Partial<DepotSafe>): DepotSafe => {
  let address = opts.address || generateAddress();
  let owners = opts.owners || [generateAddress()];
  return {
    ...defaultDepotSafe,
    createdAt: Date.now() / 1000,
    ...opts,
    address,
    owners,
  };
};
