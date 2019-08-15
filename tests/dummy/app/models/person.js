import DS from 'ember-data';
import { computed } from '@ember/object';

const { Model, attr } = DS;

export default class Person extends Model {
  @attr() firstName;
  @attr() lastName;

  @computed('firstName', 'lastName')
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}
