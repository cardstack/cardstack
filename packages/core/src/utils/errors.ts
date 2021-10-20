import { difference } from 'lodash';

export class CardError extends Error {
  isCardError = true;
  cause?: unknown;

  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message);
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}
export class InvalidKeysError extends CardError {}

const BLESSED_ERRORS = ['SyntaxError'];

export function assertValidKeys(actualKeys: string[], expectedKeys: string[], errorMessage: string) {
  let unexpectedFields = difference(actualKeys, expectedKeys);

  if (unexpectedFields.length) {
    throw new InvalidKeysError(errorMessage.replace('%list%', '"' + unexpectedFields.join(', ') + '"'));
  }
}

export function printCompilerError(err: any) {
  if (isAcceptableError(err)) {
    return String(err);
  }

  return err.stack;
}

function isAcceptableError(err: any) {
  return err.isCardError || BLESSED_ERRORS.includes(err.name);
}
