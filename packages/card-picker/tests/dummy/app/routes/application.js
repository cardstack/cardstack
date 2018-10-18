import Route from '@ember/routing/route';
import { inject } from '@ember/service';

export default Route.extend({
  cardstackData: inject(),

  async model() {
    return await this.get('cardstackData').load('dummypage', 'dummypage', 'isolated');
  }
});