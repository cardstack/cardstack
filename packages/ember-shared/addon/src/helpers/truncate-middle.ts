import { helper } from '@ember/component/helper';

type PostionalArgs = [string, number, number] | [string, number] | [string];

interface Signature {
  Args: {
    Positional: PostionalArgs;
  };
  Return: string;
}

export function truncateMiddle([input, startLength = 6, endLength = 4]: PostionalArgs) {
  if (input && input.length <= startLength + endLength) {
    return input;
  } else if (input) {
    return `${input.substring(0, startLength)}...${input.substring(input.length - endLength)}`;
  }
  return '';
}

export default helper<Signature>(truncateMiddle);
