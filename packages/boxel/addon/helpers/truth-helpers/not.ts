import { helper } from '@ember/component/helper';
import truthConvert from './utils/truth-convert';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function not(params: any[]): boolean {
  for (let i = 0, len = params.length; i < len; i++) {
    if (truthConvert(params[i]) === true) {
      return false;
    }
  }
  return true;
}

export default helper(not);
