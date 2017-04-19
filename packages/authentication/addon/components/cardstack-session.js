import Ember from 'ember';
import layout from '../templates/components/cardstack-session';

export default Ember.Component.extend({
  layout,
  session: Ember.inject.service(),
  cardstackSession: Ember.inject.service(),

  actions: {
    logout() {
      this.get('session').invalidate();
    }
  }

});
