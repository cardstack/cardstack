import DS from 'ember-data';
const { Model, attr } = DS;

export default class FieldType extends Model {
  @attr() title;
  @attr() description;
  @attr() mode;
  @attr() icon;
}
