import { Card } from '@cardstack/core/card';

const dateFormat = /^\d\d\d\d-[01]\d-[0123]\d$/;

export async function validate(value: string, _fieldCard: Card) {
  return typeof value === 'string' && dateFormat.test(value) && !isNaN(Date.parse(value));
}

// We serialize this card as a string instead of as a Date because Date objects
// are sensitive to timezones. Since the nature of this card is to represent a
// date that is not tied to a particular time (or timezone) we'll serialize this
// as a string instead. Consider the example of your birthday: 2019-10-30. You
// wouldn't want this value to ever be 2019-10-29 based on the timezone
// difference between the hub and the client.
export async function deserialize(value: string, _fieldCard: Card) {
  return value;
}
