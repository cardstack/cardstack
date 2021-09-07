import { helper } from '@ember/component/helper';

export function truncateMiddle(
  [input, startLength = 6, endLength = 4]: [string, number, number] /*, hash*/
) {
  if (input && input.length <= startLength + endLength) {
    return input;
  } else if (input) {
    return `${input.substring(0, startLength)}...${input.substring(
      input.length - endLength
    )}`;
  }
  return '';
}

export default helper(truncateMiddle);
