import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';

function formatValue(value) {
  if (typeof value === 'function') {
    value = value();
  }

  return value;
}

export function cssVar(values) {
  let vars = [];
  Object.keys(values).forEach((name) => {
    vars.push(`--${name}: ${formatValue(values[name])}`);
  });

  return vars.join('; ');
}

export default helper(function (params, hash) {
  return htmlSafe(cssVar(hash));
});
