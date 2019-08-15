import DS from 'ember-data';
const { Model, attr, belongsTo } = DS;

export default class Event extends Model {
  @attr() title;
  @attr() description;
  @attr() body;
  @belongsTo('person') author;
  @attr('date') publishedDate;
  @attr() imageUrl;
}
