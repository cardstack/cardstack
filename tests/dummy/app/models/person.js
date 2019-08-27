import DS from 'ember-data';
import { tracked } from '@glimmer/tracking';

const { Model, attr } = DS;

export default class Person extends Model {
  @attr() firstName;
  @attr() lastName;

  @tracked firstName;
  @tracked lastName;

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}
