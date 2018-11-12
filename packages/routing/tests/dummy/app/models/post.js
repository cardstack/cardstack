import DS from 'ember-data';

export default DS.Model.extend({
  title: DS.attr('string'),
  page: DS.belongsTo({ async: false }),
});
