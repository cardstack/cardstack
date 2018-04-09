import Route from '@ember/routing/route';
import { inject } from '@ember/service';
export default Route.extend({
  cardstackSession: inject(),
  model({user_id}) {
    if (this.get('cardstackSession.isAuthenticated')) {
      return this.get('store').findRecord('mock-user', user_id)
        .catch(err => {
          return { error: err.errors[0] };
        });
    }
  }
});
