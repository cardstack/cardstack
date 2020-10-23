import { helper } from '@ember/component/helper';
import { safeCssString } from './safe-css-string';
import uniq from 'lodash/uniq';
//@ts-ignore
import scope from 'scope-css';
import { AddressableCard } from '@cardstack/hub';

function scopeCss(css: string, cardOrCards: AddressableCard | AddressableCard[], format = 'isolated') {
  if (!css || !cardOrCards) {
    return '';
  }

  if (Array.isArray(cardOrCards)) {
    let prefixes;
    if (format === 'embedded') {
      // increasing the specificity of the embedded card
      // note: isolated card styles are leaking inside its embedded cards...
      prefixes = uniq(
        cardOrCards.map(card => `.card-renderer-embedded.${safeCssString(card.canonicalURL)}--${format}`)
      );
    } else {
      prefixes = uniq(cardOrCards.map(card => `.${safeCssString(card.canonicalURL)}--${format}`));
    }
    return scope.replace(css, `${prefixes.map(p => `${p} $1`).join(', ')}$2`);
  }

  return scope(css, `.${safeCssString(cardOrCards.canonicalURL)}--${format}`);
}

export default helper(function([css, cardOrCards, format]) {
  return scopeCss(css, cardOrCards, format);
});
