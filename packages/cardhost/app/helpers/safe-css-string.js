import { helper } from '@ember/component/helper';

export default helper(function([string]) {
  if (!string) {
    return;
  }

  return string
    .replace(/http[s]?:\/\//g, '')
    .replace(/localhost:\d*/g, 'localhost')
    .replace(/@/g, '')
    .replace(/\s/g, '-')
    .replace(/\./g, '-')
    .replace(/\//g, '-');
});
