import { helper } from '@ember/component/helper';

export default helper(function([string, from, to = '']) {
  if (!from || !string) {
    return string;
  }
  let regex = new RegExp(from, 'g');
  return string.replace(regex, to);
});
