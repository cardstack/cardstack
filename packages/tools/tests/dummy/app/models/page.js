import DS from 'ember-data';
import Ember from 'ember';
import TrackRelationships from 'ember-data-relationship-tracker';
const { Model, attr } = DS;

export default Model.extend(TrackRelationships, {
  title: attr('string'),
  body: attr({ fieldType: '@cardstack/mobiledoc', defaultValue: emptyMobiledoc }),
  created: attr('date', { defaultValue: () => new Date() }),
  street: attr('string'),
  city: attr('string'),
  state: attr('string'),
  country: attr('string'),
  zip: attr('string'),
  slug: attr('string'),

  save(...args) {
    if (this.get('isNew') && !this.get('slug') && this.get('title')) {
      this.set('slug', deriveSlug(this.get('title')));
    }
    return this._super(...args);
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

function deriveSlug(title) {
  return title.toLowerCase().replace(/[ _]+/g, '-').replace(/[^a-z-]/g, '')
}
