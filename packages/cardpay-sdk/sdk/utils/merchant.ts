export function validateMerchantId(value: string) {
  if (!value.trim().length) return 'This field is required';
  if (/[^a-z0-9]/.test(value))
    return 'The Merchant ID can only contain lowercase letters or numbers, no special characters';
  else if (value.length > 50)
    return `The Merchant ID cannot be more than 50 characters long. It is currently ${value.length} characters long`;
  return '';
}

interface MerchantPaymentURLParams {
  domain?: string;
  merchantSafeID: string;
  amount?: number;
  network: string;
  currency?: string;
}

export const generateMerchantPaymentUrl = ({
  domain = 'cardwallet:/',
  merchantSafeID,
  amount,
  network,
  currency = 'SPD',
}: MerchantPaymentURLParams) => {
  const handleAmount = amount ? `amount=${amount}&` : '';

  return `${domain}/pay/${network}/${merchantSafeID}?${handleAmount}currency=${currency}`;
};
