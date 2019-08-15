import DS from 'ember-data';
const { Model, attr, belongsTo } = DS;

export default class Article extends Model {
  @attr() title;
  @attr() description;
  @attr() body;
  @belongsTo('person') author;
  @attr('date') publishedDate;
  @attr() imageUrl;
}
