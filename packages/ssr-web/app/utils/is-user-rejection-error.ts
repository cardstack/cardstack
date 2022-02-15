// this code is dependent on CardWallet providing the appropriate error message
export function isLayer2UserRejectionError(error: {
  message: string;
  code?: number;
}) {
  return error.message === 'User rejected request';
}
