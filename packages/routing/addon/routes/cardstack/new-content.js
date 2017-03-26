import Ember from 'ember';
import { singularize }  from 'ember-inflector';

export default Ember.Route.extend({
  cardstackRouting: Ember.inject.service(),
  resourceMetadata: Ember.inject.service(),
  model({ type }) {
    let branch = this.modelFor('cardstack').branch;
    let model = this.store.createRecord(singularize(type));
    this.get('resourceMetadata').write(model, { branch });
    return model;
  }
});
