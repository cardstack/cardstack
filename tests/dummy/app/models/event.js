import Model, { attr, belongsTo } from '@ember-data/model';

export default class Event extends Model {
  @attr() title;
  @attr() description;
  @attr() body;
  @belongsTo('person') author;
  @attr('date') publishedDate;
  @attr() imageUrl;
  @attr('date') datetime;
  @attr() location;
  @attr() price;
  @attr() address;
}
