/**
 * Do not use this constant where possible, instead use PrepaidCard.getPaymentLimits
 * This constant is here because it is used in a page where PrepaidCard.getPaymentLimits cannot
 * be called as there is no web3 connection
 */
export const MIN_PAYMENT_AMOUNT_IN_SPEND = 50;
