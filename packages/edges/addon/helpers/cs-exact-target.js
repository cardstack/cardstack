import { helper } from '@ember/component/helper';
import $ from 'jquery';

export default helper(function([selector, handler]) {
  return function(event) {
    if ($(event.target).is(selector) && handler) {
      return handler(event);
    }
  };
});
