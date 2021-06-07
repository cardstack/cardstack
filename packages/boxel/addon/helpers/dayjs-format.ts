import dayjs from 'dayjs';
import Helper from '@ember/component/helper';

const DEFAULT_LOCALE = 'en';
const DEFAULT_OUTPUT_FORMAT = 'D MMMM, YYYY';

export default Helper.helper(function compute(
  params,
  hash: { locale: string }
) {
  const { length } = params;

  if (length > 3) {
    throw new TypeError(
      'ember-moment: Invalid number of arguments, expected at most 3'
    );
  }

  const args = [];
  const formatArgs = [];

  args.push(params[0]);

  if (length === 1) {
    formatArgs.push(DEFAULT_OUTPUT_FORMAT);
  } else if (length === 2) {
    formatArgs.push(params[1]);
  } else if (length > 2) {
    args.push(params[2]);
    formatArgs.push(params[1]);
  }

  return dayjs(...args)
    .locale(hash.locale || DEFAULT_LOCALE)
    .format(...formatArgs);
});
