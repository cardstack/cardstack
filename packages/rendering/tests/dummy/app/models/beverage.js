import DS from 'ember-data';

export default DS.Model.extend({
  flavor: DS.attr('string'),
  size: DS.attr('number'),
  sizeUnits: DS.attr('string'),
});
