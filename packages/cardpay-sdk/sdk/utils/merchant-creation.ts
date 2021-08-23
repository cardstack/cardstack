export function validateMerchantId(value: string) {
  if (!value.trim().length) return 'This field is required';
  if (/[^a-z0-9]/.test(value)) return 'Merchant ID can only contain lowercase alphabets and numbers';
  else if (value.length > 50) return `Merchant ID must be at most 50 characters, currently ${value.length}`;
  return '';
}
