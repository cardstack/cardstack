import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';

export default class TestComputed {
  @contains(string)
  firstName;

  @contains(string)
  maritalStatus;

  @contains(string)
  partnerName;

  @contains(string)
  get salutation() {
    if (this.maritalStatus === 'married') {
      return 'Hello ' + this.firstName + ' and ' + this.partnerName;
    } else {
      return 'Hello ' + this.firstName;
    }
  }
}
