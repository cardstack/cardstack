import Ember from 'ember';
const { htmlSafe } = Ember.String

function formatAttrs(attrs) {
  return Object.keys(attrs)
    .map((key) => attrs[key] != null && `${key}="${attrs[key]}"`)
    .filter((attr) => attr)
    .join(' ');
}

export function csSvg([name], hash) {
  return htmlSafe(`<svg ${formatAttrs(hash)}><use xlink:href="${'#' + name}"></use></svg>`);
}

export default Ember.Helper.helper(csSvg);
