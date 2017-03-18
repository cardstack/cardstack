import Ember from 'ember';
const { htmlSafe } = Ember.String;

export default Ember.Helper.extend({
  init() {
    this._super.apply(this, arguments);
    this.environment = Ember.getOwner(this).resolveRegistration('config:environment').environment;
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
  }
});
