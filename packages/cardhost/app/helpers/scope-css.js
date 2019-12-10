import { helper } from '@ember/component/helper';
import scope from 'scope-css';

// Prefixes all CSS rules with the parent class name
// Requires two params, the CSS and a class name or ID to add to the front of every rule.

export default helper(function scopeCss(params) {
  if (!params[0] || !params[1]) {
    return '';
  }

  // local-hub::my-card becomes my-card
  return scope(params[0], `.${params[1]}`);
});
