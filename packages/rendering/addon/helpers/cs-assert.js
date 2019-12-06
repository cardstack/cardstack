import { getOwner } from '@ember/application';
import Helper from '@ember/component/helper';
import { htmlSafe } from '@ember/string';

export default Helper.extend({
  init() {
    this._super.apply(this, arguments);
    this.environment = getOwner(this).resolveRegistration('config:environment').environment;
  },
  compute(messages) {
    if (this.environment === 'production') {
      return;
    }

    let message = messages.join(' ');
    if (this.environment === 'development') {
      return htmlSafe(`<div style="color: red">${message}</div>`);
    }

    throw new Error(message);
  },
});
