import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-session';

export default Component.extend({
  layout,
  tagName: '',
  session: service(),
  cardstackSession: service(),

  actions: {
    logout() {
      this.get('session').invalidate();
    },
  },
});
