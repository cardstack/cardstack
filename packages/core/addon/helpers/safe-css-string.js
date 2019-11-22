import { helper } from '@ember/component/helper';

export default helper(function([string]) {
  return string
  .replace(/@/g, '')
  .replace(/\//g, '-');
});
