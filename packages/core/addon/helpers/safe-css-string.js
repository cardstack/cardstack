import { helper } from '@ember/component/helper';

export default helper(function([string]) {
  if (!string) {
    return;
  }

  return string.replace(/@/g, '').replace(/\//g, '-');
});
