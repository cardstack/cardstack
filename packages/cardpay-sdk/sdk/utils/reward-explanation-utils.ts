import BigNumber from 'bignumber.js';

/**
 * parseTemplateExplanation
 * Taken from https://gist.github.com/smeijer/6580740a0ff468960a5257108af1384e?permalink_comment_id=3437778#gistcomment-3437778
 * @param template string such as in explanationTemplate: Earned {amount} {token} for a one-time aidrop. {rollover_amount} tokens.
 * @param data object such as explanationData: { "amount": "100.0", "token": "0xB0427e9F03Eb448D030bE3EBC96F423857ceEb2f" }.
 * @returns formatted string such as: Earned 100.0 CARD.CPXD for a one-time aidrop. {rollover_amount} tokens.
 */
export const parseTemplateExplanation = (template: string, data?: any) => {
  // matchToken is the tokenName with brackets, as in `{a}` where token name is `a`.
  return template.replace(/\{([^}]+)}/g, (matchedToken, tokenName) => {
    // split and iterate on nested tokens, like `{a.b.c}`.
    return (
      tokenName.split('.').reduce((splittedToken: any, key: any) => {
        return splittedToken ? splittedToken[key] : undefined;
      }, data) ?? matchedToken // returns "untouched" token with brackets when no value can be computed.
    );
  });
};

/**
 * parseExplanationAmount
 * @param amount amount number in WEI as defined in explanationData.
 * @param tokenDecimals places to shift the decimal point.
 * @param resultDecimals decimal places to keep in the result
 * @returns formatted string with amount converted to readable string.
 */
export const parseExplanationAmount = (amount: BigNumber.Value, tokenDecimals: number, resultDecimals = 2) =>
  new BigNumber(amount).shiftedBy(-tokenDecimals).toFixed(resultDecimals);
