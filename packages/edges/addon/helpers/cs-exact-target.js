import { helper } from '@ember/component/helper';

export default helper(function([selector, handler]) {
  return function(event) {
    if (event.target.matches(selector) && handler) {
      return handler(event);
    }
  };
});
