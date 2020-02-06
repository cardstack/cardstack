import { helper } from '@ember/component/helper';

export default helper(function([string]) {
  if (!string) {
    return;
  }

  return string
    .replace(/https:\/\//g, '')
    .replace(/@/g, '')
    .replace(/\s/g, '-')
    .replace(/\./g, '-')
    .replace(/\//g, '-');
});
