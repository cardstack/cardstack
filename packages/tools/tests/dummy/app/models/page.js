import DS from 'ember-data';
import Ember from 'ember';
const { Model, attr } = DS;

export default Model.extend({
  title: attr('string'),
  body: attr({ fieldType: 'mobiledoc' }),
  created: attr('date'),
  street: attr('string'),
  city: attr('string'),
  state: attr('string'),
  country: attr('string'),
  zip: attr('string'),

  type: Ember.computed(function() {
    // for some weird reason, you can't just say
    // `model.constructor.modelName` in a template to get this. It
    // works if you provide this computed property.
    return this.constructor.modelName;
  })
});
