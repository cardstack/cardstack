import { helper } from '@ember/component/helper';

export function lt(
  [left, right]: [unknown, unknown],
  hash: { forceNumber?: boolean }
): boolean {
  if (hash.forceNumber) {
    if (typeof left !== 'number') {
      left = Number(left);
    }
    if (typeof right !== 'number') {
      right = Number(right);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (left as any) < (right as any);
}

export default helper(lt);
