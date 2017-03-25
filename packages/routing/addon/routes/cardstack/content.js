import Ember from 'ember';

export default Ember.Route.extend({
  model({ type, slug }) {
    return this.store.queryRecord(Ember.String.singularize(type), {
      filter: { slug },
      branch: this.modelFor('cardstack').branch
    });
  }
});
