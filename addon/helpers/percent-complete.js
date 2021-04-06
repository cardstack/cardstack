import { helper } from '@ember/component/helper';

export function percentComplete(_params, { total, completed }) {
  let result = Math.round((completed / total) * 100);
  if (isNaN(result)) {
    return 0;
  }
  return result;
}

export default helper(function () {
  return percentComplete(...arguments);
});
