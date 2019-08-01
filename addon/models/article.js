import DS from 'ember-data';
const { Model, attr, belongsTo } = DS;

export default Model.extend({
  title: attr(),
  description: attr(),
  body: attr(),
  author: belongsTo('person'),
  publishedDate: attr('date'),
  imageUrl: attr(),
});
