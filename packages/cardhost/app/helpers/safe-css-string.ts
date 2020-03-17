import { helper } from '@ember/component/helper';
export function safeCssString(string: string) {
  if (!string) {
    return;
  }

  return string
    .replace(/http[s]?:\/\//g, '')
    .replace(/http[s]?%3A%2F%2F/g, '')
    .replace(/localhost:\d*/g, 'localhost')
    .replace(/localhost%3A\d*/g, 'localhost')
    .replace(/@/g, '')
    .replace(/\s/g, '-')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/%2F/g, '-')
    .replace(/%/g, '_');
}

export default helper(function([string]) {
  return safeCssString(string);
});
