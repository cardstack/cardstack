import { helper } from '@ember/component/helper';
import { safeCssString } from './safe-css-string';
import uniq from 'lodash/uniq';
import scope from 'scope-css';

export default helper(function scopeCss([css, cardOrCards, format]) {
  if (!css || !cardOrCards) {
    return '';
  }

  if (Array.isArray(cardOrCards) && format) {
    let prefixes = uniq(cardOrCards.map(card => `.${safeCssString(card.canonicalURL)}--${format}`));
    return scope.replace(css, `${prefixes.map(p => `${p} $1`).join(', ')}$2`);
  }

  return scope(css, `.${safeCssString(cardOrCards.canonicalURL)}--${format}`);
});
