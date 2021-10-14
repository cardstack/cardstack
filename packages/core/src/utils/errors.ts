import { difference } from 'lodash';

class CompilerError extends Error {
  isCompilerError = true;
}
export class InvalidKeysError extends CompilerError {}

export function assertValidKeys(actualKeys: string[], expectedKeys: string[], errorMessage: string) {
  let unexpectedFields = difference(actualKeys, expectedKeys);

  if (unexpectedFields.length) {
    throw new InvalidKeysError(errorMessage.replace('%list%', '"' + unexpectedFields.join(', ') + '"'));
  }
}
