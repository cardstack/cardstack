import Model, { attr } from '@ember-data/model';

export default class FieldType extends Model {
  @attr() title;
  @attr() description;
  @attr() mode;
  @attr() icon;
}
