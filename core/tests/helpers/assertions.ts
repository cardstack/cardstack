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
