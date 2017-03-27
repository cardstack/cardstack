import DS from 'ember-data';

export default DS.Model.extend({
  isCardstackPlaceholder: true,
  branch: DS.attr(),
  slug: DS.attr(),
  type: DS.attr()
});
