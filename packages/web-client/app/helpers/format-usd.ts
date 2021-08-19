import { helper } from '@ember/component/helper';
import { formatUsd, FormatUsdOptions } from '@cardstack/cardpay-sdk';

let DEFAULT_OPTIONS = {
  symbol: '$',
  suffix: ' USD',
};

export default helper(
  ([usdAmount]: [number], options: Partial<FormatUsdOptions> = {}) => {
    let opts = Object.assign({}, DEFAULT_OPTIONS, options) as FormatUsdOptions;
    return formatUsd(usdAmount, opts);
  }
);
