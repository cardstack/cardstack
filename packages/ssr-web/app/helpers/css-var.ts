import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';

type StringOrFuncReturningString = string | (() => string);

function formatValue(value: StringOrFuncReturningString) {
  if (typeof value === 'function') {
    value = value();
  }

  return value;
}

export function cssVar(values: Record<string, StringOrFuncReturningString>) {
  let vars: string[] = [];
  Object.keys(values).forEach((name) => {
    vars.push(`--${name}: ${formatValue(values[name])}`);
  });

  return vars.join('; ');
}

export default helper(function (_params, hash) {
  return htmlSafe(cssVar(hash));
});
