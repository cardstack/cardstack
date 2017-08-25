import DS from 'ember-data';

export default DS.Model.extend({
  category: DS.attr('string'),
  status: DS.attr('string'),
  isHandled: DS.attr('boolean'),
});
