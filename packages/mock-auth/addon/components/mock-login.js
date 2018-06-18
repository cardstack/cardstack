import { inject as service } from '@ember/service';
import { get, set } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/mock-login';

export default Component.extend({
  layout,
  tagName: '',
  mockLogin: service(),

  init() {
    this._super();

    let service = get(this, 'mockLogin');
    let onAuthentication = get(this, 'onAuthenticationSuccess');
    let onPartialAuthentication = get(this, 'onPartialAuthenticationSuccess');
    let onAuthenticationFailed = get(this, 'onAuthenticationFailed');

    if (typeof onAuthentication === 'function') {
      set(service, 'authenticationHandler', onAuthentication.bind(this));
    }
    if (typeof onPartialAuthentication === 'function') {
      set(service, 'partialAuthenticationHandler', onPartialAuthentication.bind(this));
    }
    if (typeof onAuthenticationFailed === 'function') {
      set(service, 'authenticationFailedHandler', onAuthenticationFailed.bind(this));
    }
  },
});
