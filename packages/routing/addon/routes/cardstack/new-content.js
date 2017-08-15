import Ember from 'ember';
import { modelType } from '../..';

export default Ember.Route.extend({
  model({ type }) {
    let branch = this.modelFor('cardstack').branch;
    return this.store.createRecord(modelType(type, branch));
  }
});
