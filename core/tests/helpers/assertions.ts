import isEqual from 'lodash/isEqual';
import QUnit from 'qunit';

function standardize(src: string) {
  return src
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s{2,}/gm, ' ')
    .trim();
}

export function equalIgnoringWhiteSpace(
  actual: string,
  expected: string,
  message?: string
): void {
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

export function containsSource(
  actual: string | undefined,
  expected: string,
  message?: string
): void {
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

export function assertEqualSets(
  actual: unknown,
  expected: string[],
  message?: string
): void {
  let expectedSet = new Set(expected);
  let result = isEqual(actual, expectedSet);
  message ||= 'Sets<> are equal';
  QUnit.assert.pushResult({
    result,
    actual,
    expected: expectedSet,
    message,
  });
}
