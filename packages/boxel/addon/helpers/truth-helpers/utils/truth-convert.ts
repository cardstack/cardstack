import { isArray } from '@ember/array';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export default function truthConvert(result: any): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const truthy = result && result.isTruthy;
  if (typeof truthy === 'boolean') {
    return truthy;
  }

  if (isArray(result)) {
    return result.length !== 0;
  } else {
    return !!result;
  }
}
