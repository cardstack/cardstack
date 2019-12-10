import { helper } from '@ember/component/helper';
import scope from 'scope-css';

/** Prefixes all CSS rules with the parent class name
 Requires two params, the CSS and a class name or ID to add to the front of every rule.
 Example: 
 `{{scope-css ".something { color: blue; }" ".parent-class"}}`
 Returns this string:
 ".parent-class .something { color: blue; }"
*/

export default helper(function scopeCss(params) {
  if (!params[0] || !params[1]) {
    return '';
  }
  return scope(params[0], `.${params[1]}`);
});
