import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';

type CSSValueOrFuncReturningCSSValue =
  | string
  | number
  | (() => string)
  | undefined;

function formatValue(value: CSSValueOrFuncReturningCSSValue) {
  if (typeof value === 'function') {
    value = value();
  }
  if (typeof value === 'number') {
    value = value.toString();
  }

  return value;
}

export function cssVar(
  values: Record<string, CSSValueOrFuncReturningCSSValue>
): string {
  let vars: string[] = [];
  Object.keys(values).forEach((name) => {
    if (values[name] !== undefined) {
      vars.push(`--${name}: ${formatValue(values[name])}`);
    }
  });

  return vars.join('; ');
}

export default helper(function (
  _params,
  hash: Record<string, CSSValueOrFuncReturningCSSValue>
) {
  return htmlSafe(cssVar(hash));
});
