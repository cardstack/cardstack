import DS from 'ember-data';
import { computed } from '@ember/object';

const { Model } = DS;

export default Model.extend({
  firstName: Attr(),
  lastName: Attr(),
  fullName: computed('firstName', 'lastName', function() {
    return `${this.firstName} ${this.lastName}`;
  })
});
