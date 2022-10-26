import { helper } from '@ember/component/helper';

function truncateMiddle([input, startLength = 6, endLength = 4]) {
  if (input && input.length <= startLength + endLength) {
    return input;
  } else if (input) {
    return `${input.substring(0, startLength)}...${input.substring(input.length - endLength)}`;
  }

  return '';
}
var truncateMiddle$1 = helper(truncateMiddle);

export { truncateMiddle$1 as default, truncateMiddle };
//# sourceMappingURL=truncate-middle.js.map
