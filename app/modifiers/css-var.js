import { modifier } from 'ember-modifier';

export default modifier(function cssVar(element, params, values) {
  if (!element) {
    return;
  }

  Object.keys(values).forEach(key => {
    let value = typeof values[key] === 'function' ? values[key]() : values[key];
    element.style.setProperty(`--${key}`, value);
  });
});
