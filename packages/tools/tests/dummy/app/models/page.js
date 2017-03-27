import DS from 'ember-data';
import Ember from 'ember';
import TrackRelationships from 'ember-data-relationship-tracker';
const { Model, attr } = DS;

export default Model.extend(TrackRelationships, {
  title: attr('string'),
  body: attr({ fieldType: '@cardstack/mobiledoc', defaultValue: emptyMobiledoc }),
  created: attr('date'),
  street: attr('string'),
  city: attr('string'),
  state: attr('string'),
  country: attr('string'),
  zip: attr('string'),
  slug: attr('string'),

  type: Ember.computed(function() {
    // for some weird reason, you can't just say
    // `model.constructor.modelName` in a template to get this. It
    // works if you provide this computed property.
    return this.constructor.modelName;
  }),

  init() {
    this._super.apply(this, arguments);
  }
});

function emptyMobiledoc() {
  return {
    version: "0.3.1",
    markups: [],
    atoms: [],
    cards: [],
    sections: [
      [1, "p", [
        [0, [], 0, ""]
      ]]
    ]
  };
}
