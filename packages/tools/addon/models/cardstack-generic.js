import DS from 'ember-data';
const { Model, attr } = DS;

export default Model.extend({
  realId: attr(),
  realType: attr('string'),
  attributes: attr(),
  relationships: attr(),
});
