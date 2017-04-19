import Ember from 'ember';
import layout from '../templates/components/github-login';

export default Ember.Component.extend({
  layout,
  session: Ember.inject.service(),
  tagName: '',

  actions: {
    login() {
      this.get('session').authenticate('authenticator:cardstack-torii', 'github');
    }
  }
});
