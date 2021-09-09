import isEqual from 'lodash/isEqual';
import QUnit from 'qunit';

function standardize(src: string) {
  return src
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s{2,}/gm, ' ')
    .trim();
}

export function equalIgnoringWhiteSpace(actual: string, expected: string, message?: string): void {
  actual = standardize(actual);
  expected = standardize(expected);
  let result = actual === expected;

  message ||= 'Strings are equal';

  QUnit.assert.pushResult({
    result,
    actual,
    expected,
    message,
  });
}

export function containsSource(actual: string | undefined, expected: string, message?: string): void {
  actual = standardize(actual ?? '');
  expected = standardize(expected);
  let result = actual.includes(expected) || false;
  message ||= 'Contains source';
  QUnit.assert.pushResult({
    result,
    actual,
    expected,
    message,
  });
}

export function assert_isEqual<T>(actual: T, expected: T, message?: string): void {
  message ||= 'isEqual';
  let result = isEqual(actual, expected);

  let printActual: any = actual;
  let printExpected: any = expected;

  if (actual instanceof Map) {
    printActual = Object.fromEntries(actual);
  }

  if (actual instanceof Set) {
    printActual = [...actual];
  }

  if (expected instanceof Map) {
    printExpected = Object.fromEntries(expected);
  }

  if (expected instanceof Set) {
    printExpected = [...expected];
  }

  QUnit.assert.pushResult({
    result,
    actual: printActual,
    expected: printExpected,
    message,
  });
}
