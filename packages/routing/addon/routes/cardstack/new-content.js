import Ember from 'ember';
import { singularize }  from 'ember-inflector';

export default Ember.Route.extend({
  cardstackRouting: Ember.inject.service(),
  model({ type }) {
    // let branch = this.modelFor('cardstack').branch;
    return this.store.createRecord(singularize(type));
  }
});
