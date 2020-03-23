import { Card } from '@cardstack/hub';
import { Expression } from '@cardstack/core/expression';
import CardstackError from '@cardstack/core/error';
import { isParam } from '@cardstack/hub/pgsearch/util';

// Format is YYYY-MM-DDTHH:mm:ss.sssZ (allows up to 6 digit years)
const dateTimeFormat = /^\d{4,6}-[01]\d-[0123]\dT[0,1,2]\d:[012345]\d:[012345]\d\.\d{3}Z$/;

export function buildValueExpression(expression: Expression): Expression {
  let [value] = expression;
  let dateTime: string | undefined;
  if (isParam(value)) {
    dateTime = value.param as string;
  } else if (typeof value === 'string') {
    dateTime = value;
  } else {
    throw new CardstackError(`Do not know how to process value expression ${JSON.stringify(value)} as a date-time`, {
      status: 400,
    });
  }

  if (!_validate(dateTime)) {
    throw new CardstackError(
      `The value expression in the query '${dateTime}' is not a valid ISO 8601 date-time (YYYY-MM-DDTHH:mm:ss.sssZ)`,
      { status: 400 }
    );
  }
  return expression;
}

export async function validate(value: string, _fieldCard: Card) {
  return _validate(value);
}

export async function deserialize(value: string, _fieldCard: Card) {
  return new Date(value);
}

function _validate(date: string) {
  return typeof date === 'string' && dateTimeFormat.test(date) && !isNaN(Date.parse(date));
}
