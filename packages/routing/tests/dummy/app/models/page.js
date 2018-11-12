import DS from 'ember-data';

export default DS.Model.extend({
  blurb: DS.attr('string'),
  permalink: DS.attr('string'),
}).reopenClass({
  routingField: 'permalink',
});
