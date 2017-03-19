import DS from 'ember-data';
import Ember from 'ember';
const { Model, attr } = DS;

export default Model.extend({
  title: attr('string'),
  body: attr(),
  type: Ember.computed(function() {
    // for some weird reason, you can't just say
    // `model.constructor.modelName` in a template to get this. It
    // works if you provide this computed property.
    return this.constructor.modelName;
  })
});
