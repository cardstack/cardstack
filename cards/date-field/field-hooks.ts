import { Card } from '@cardstack/hub';
import { Expression } from '@cardstack/hub';
import { isParam } from '@cardstack/hub/pgsearch/util';
import { Error } from '@cardstack/hub';

const dateFormat = /^\d{4,6}-[01]\d-[0123]\d$/;

export function buildValueExpression(expression: Expression): Expression {
  let [value] = expression;
  let date: string | undefined;
  if (isParam(value)) {
    date = value.param as string;
  } else if (typeof value === 'string') {
    date = value;
  } else {
    throw new Error(`Do not know how to process value expression ${JSON.stringify(value)} as a date`, {
      status: 400,
    });
  }

  if (!_validate(date)) {
    throw new Error(`The value expression in the query '${date}' is not a valid YYYY-MM-DD date`, {
      status: 400,
    });
  }
  return expression;
}

export async function validate(value: string, _fieldCard: Card) {
  return _validate(value);
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

function _validate(date: string) {
  return typeof date === 'string' && dateFormat.test(date) && !isNaN(Date.parse(date));
}
