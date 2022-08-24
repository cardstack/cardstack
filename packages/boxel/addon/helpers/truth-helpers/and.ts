import { helper } from '@ember/component/helper';
import truthConvert from './utils/truth-convert';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function and(params: any[]): boolean {
  for (let i = 0, len = params.length; i < len; i++) {
    if (truthConvert(params[i]) === false) {
      return params[i];
    }
  }
  return params[params.length - 1];
}

export default helper(and);
