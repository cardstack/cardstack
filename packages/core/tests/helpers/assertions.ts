import type Chai from 'chai';

function standardize(src: string) {
  return src
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s{2,}/gm, ' ')
    .trim();
}

export default function (chai: typeof Chai) {
  const { Assertion } = chai;
  Assertion.addMethod('equalIgnoringWhiteSpace', function (expected: string): void {
    let actual = standardize(this._obj);
    expected = standardize(expected);

    this.assert(
      actual === expected,
      `expected strings to be the same`,
      'expected strings not to be the same',
      expected,
      actual
    );
  });

  Assertion.addMethod('containsSource', function (expected: string): void {
    let actual = standardize(this._obj ?? '');
    expected = standardize(expected);
    let result = actual.includes(expected) || false;
    this.assert(
      result,
      `expected source to contain "${expected}"`,
      `expected source not to contain "${expected}"`,
      expected,
      actual
    );
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Chai {
    interface Assertion {
      equalIgnoringWhiteSpace(expectedSource: string): void;
      containsSource(expectedSource: string): void;
    }
  }
}
