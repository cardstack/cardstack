import { Factory } from 'ember-cli-mirage';
import faker from 'faker';

export default Factory.extend({
  firstName() {
    return faker.name.firstName
  },
  lastName() {
    return faker.name.lastName
  }
});
