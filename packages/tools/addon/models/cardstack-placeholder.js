import DS from 'ember-data';

export default DS.Model.extend({
  isCardstackPlaceholder: true,
  slug: DS.attr(),
  type: DS.attr()
});
