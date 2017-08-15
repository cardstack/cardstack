import DS from 'ember-data';

export default DS.Model.extend({
  flavor: DS.attr('string'),
  sizeOz: DS.attr('number')
});
