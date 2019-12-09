import Route from '@ember/routing/route';

export default Route.extend({
  async model({ id }) {
    return this.store.findRecord('post', id);
  },
});
