import { isAddress } from 'web3-utils';
import {
  CARDWALLET_SCHEME,
  MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME,
  MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
} from '../constants';
import Url from 'url-parse';

export function validateMerchantId(value: string) {
  const subdomainFriendlyLength = 50;
  if (!value.trim().length) return 'This field is required';
  if (/[^a-z0-9]/.test(value))
    return 'The Business ID can only contain lowercase letters or numbers, no special characters';
  else if (value.length > subdomainFriendlyLength)
    return `The Business ID cannot be more than ${subdomainFriendlyLength} characters long. It is currently ${value.length} characters long`;
  return '';
}

const isUniversalDomain = (domain: string) =>
  [MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME, MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME].includes(domain);

interface MerchantPaymentURLParams {
  domain?: string;
  merchantSafeID: string;
  amount?: number;
  network: string;
  currency?: string;
}

export const generateMerchantPaymentUrl = ({
  domain = `${CARDWALLET_SCHEME}:/`,
  merchantSafeID,
  amount,
  network,
  currency = 'SPD',
}: MerchantPaymentURLParams) => {
  const handleAmount = amount ? `amount=${amount}&` : '';
  const https = isUniversalDomain(domain) ? 'https://' : '';

  return `${https}${domain}/pay/${network}/${merchantSafeID}?${handleAmount}currency=${currency}`;
};

// see https://github.com/cardstack/cardstack/pull/2095 for test cases used during dev
export const isValidMerchantPaymentUrl = (merchantPaymentUrl: string) => {
  let url = new Url(merchantPaymentUrl);

  return isValidCustomProtocolMerchantPaymentUrl(url) || isValidUniversalLinkMerchantPaymentUrl(url);
};

export const isValidUniversalLinkMerchantPaymentUrl = (url: Url) => {
  const usesCorrectProtocol = url.protocol === `https:`;
  const hasCorrectHostname = isUniversalDomain(url.hostname);
  const parts = url.pathname.split('/');
  // skip the leading slash
  let [, action, network, merchantSafeID] = parts;
  let hasCorrectPath =
    parts.length === 4 && action === 'pay' && ['sokol', 'xdai'].includes(network) && isAddress(merchantSafeID);

  return usesCorrectProtocol && hasCorrectHostname && hasCorrectPath;
};

export const isValidCustomProtocolMerchantPaymentUrl = (url: Url) => {
  let usesCorrectProtocol = url.protocol === `${CARDWALLET_SCHEME}:`;
  let parts = url.pathname.split('/');
  // skip the leading slash
  let [, network, merchantSafeID] = parts;
  let hasCorrectPath =
    parts.length === 3 && url.hostname === 'pay' && ['sokol', 'xdai'].includes(network) && isAddress(merchantSafeID);

  return usesCorrectProtocol && hasCorrectPath;
};
