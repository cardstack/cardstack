import { Factory } from 'ember-cli-mirage';
import faker from 'faker';

export default class PersonFactory extends Factory  {
  firstName() {
    return faker.name.firstName
  }

  lastName() {
    return faker.name.lastName
  }
}
