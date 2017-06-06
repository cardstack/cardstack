import Ember from 'ember';
import layout from '../templates/components/email-login';
import { task } from 'ember-concurrency';

const { getOwner, Component, inject: { service } } = Ember;

export default Component.extend({
  layout,
  session: service(),
  cardstackSession: service(),

  // This is the id of the authentication-sources model on the
  // server. Ours uses 'email' by default. It would theoretically be
  // possible to configure others so that you could use multiple
  // different email authentication sources at onces.
  source: 'email',

  login: task(function * () {
    let email = this.get('email'),
       config = getOwner(this).resolveRegistration('config:environment'),
      referer = location.origin + (config.rootURL || '');


    yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { email, referer });

  }).drop()
});