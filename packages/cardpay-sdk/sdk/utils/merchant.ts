import { isAddress } from 'web3-utils';
import {
  CARDWALLET_SCHEME,
  MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME,
  MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
} from '../constants';
import Url from 'url-parse';
import { isCardPaySupportedNetwork } from '../network-config-utils';

/**
 * @group Utils
 * @category Merchant
 */
export function validateMerchantId(value: string) {
  const subdomainFriendlyLength = 50;
  if (!value.trim().length) return 'This field is required';
  if (/[^a-z0-9]/.test(value)) return 'Unique ID can only contain lowercase letters or numbers, no special characters';
  else if (value.length > subdomainFriendlyLength)
    return `Unique ID cannot be more than ${subdomainFriendlyLength} characters long. It is currently ${value.length} characters long`;
  return '';
}

const isUniversalDomain = (domain: string) =>
  [MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME, MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME].includes(domain);

/**
 * @group Utils
 * @category Merchant
 */
export interface MerchantPaymentURLParams {
  domain?: string;
  merchantSafeID: string;
  amount?: number;
  network: string;
  currency?: string;
}

/**
 * @group Utils
 * @category Merchant
 */
export const generateMerchantPaymentUrl = ({
  domain = `${CARDWALLET_SCHEME}:/`,
  merchantSafeID,
  amount,
  network,
  currency,
}: MerchantPaymentURLParams) => {
  const handleAmountAndCurrency = currency ? `?${amount ? `amount=${amount}&` : ''}currency=${currency}` : '';
  const https = isUniversalDomain(domain) ? 'https://' : '';

  return `${https}${domain}/pay/${network}/${merchantSafeID}${handleAmountAndCurrency}`;
};

/**
 * see https://github.com/cardstack/cardstack/pull/2095 for test cases used during dev
 * @group Utils
 * @category Merchant
 */
export const isValidMerchantPaymentUrl = (merchantPaymentUrl: string) => {
  let url = new Url(merchantPaymentUrl);

  return isValidCustomProtocolMerchantPaymentUrl(url) || isValidUniversalLinkMerchantPaymentUrl(url);
};

/**
 * @group Utils
 * @category Merchant
 */
export const isValidUniversalLinkMerchantPaymentUrl = (url: Url) => {
  const usesCorrectProtocol = url.protocol === `https:`;
  const hasCorrectHostname = isUniversalDomain(url.hostname);
  const parts = url.pathname.split('/');
  // skip the leading slash
  let [, action, network, merchantSafeID] = parts;
  let hasCorrectPath =
    parts.length === 4 && action === 'pay' && isCardPaySupportedNetwork(network) && isAddress(merchantSafeID);

  return usesCorrectProtocol && hasCorrectHostname && hasCorrectPath;
};

/**
 * @group Utils
 * @category Merchant
 */
export const isValidCustomProtocolMerchantPaymentUrl = (url: Url) => {
  let usesCorrectProtocol = url.protocol === `${CARDWALLET_SCHEME}:`;
  let parts = url.pathname.split('/');
  // skip the leading slash
  let [, network, merchantSafeID] = parts;
  let hasCorrectPath =
    parts.length === 3 && url.hostname === 'pay' && isCardPaySupportedNetwork(network) && isAddress(merchantSafeID);

  return usesCorrectProtocol && hasCorrectPath;
};
