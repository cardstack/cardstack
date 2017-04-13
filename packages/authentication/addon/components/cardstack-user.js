import Ember from 'ember';
import layout from '../templates/components/cardstack-user';

export default Ember.Component.extend({
  layout,
  session: Ember.inject.service(),

  actions: {
    login() {
      this.get('session').authenticate('authenticator:cardstack-torii', 'github');
    },
    logout() {
      this.get('session').invalidate().then(() => window.location.reload());
    }
  }

});
