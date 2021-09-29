import {
  MerchantSafe,
  PrepaidCardSafe,
  DepotSafe,
} from '@cardstack/cardpay-sdk/sdk/safes';
import { BridgeableSymbol } from '@cardstack/web-client/utils/token';
import Web3 from 'web3';

// The address generation is not for production use. web3 notes the following:
// This package has NOT been audited and might potentially be unsafe.
// Take precautions to clear memory properly, store the private keys safely, and test transaction receiving and sending functionality properly before using in production!
let web3Instance = new Web3();
let generateAddress = () => web3Instance.eth.accounts.create().address;

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
