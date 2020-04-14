import Model, { attr, belongsTo } from '@ember-data/model';

export default class Article extends Model {
  @attr() title;
  @attr() description;
  @attr() body;
  @belongsTo('person') author;
  @attr('date') publishedDate;
  @attr() imageUrl;
  @attr() mode;
}
