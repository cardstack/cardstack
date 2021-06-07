import { helper } from '@ember/component/helper';

interface PercentCompleteOptions {
  total: number;
  completed: number;
}
export function percentComplete(
  _params: never,
  { total, completed }: PercentCompleteOptions
): number {
  let result = Math.round((completed / total) * 100);
  if (isNaN(result)) {
    return 0;
  }
  return result;
}

export default helper(function (params: never, hash: PercentCompleteOptions) {
  return percentComplete(params, hash);
});
