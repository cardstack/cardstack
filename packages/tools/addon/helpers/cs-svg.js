import { helper as buildHelper } from '@ember/component/helper';
import { htmlSafe } from '@ember/string';

function formatAttrs(attrs) {
  return Object.keys(attrs)
    .map((key) => attrs[key] != null && `${key}="${attrs[key]}"`)
    .filter((attr) => attr)
    .join(' ');
}

export function csSvg([name], hash) {
  return htmlSafe(`<svg ${formatAttrs(hash)}><use xlink:href="${'#' + name}"></use></svg>`);
}

export default buildHelper(csSvg);
