import type Chai from 'chai';

export default function (chai: typeof Chai, utils: any) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { Assertion } = chai;

  function detail(response: any) {
    if (response.isCardstackError) {
      return utils.inspect(response.toJSON());
    }
    if (response.body) {
      return utils.inspect(response.body);
    }
    return utils.inspect(response);
  }

  Assertion.addMethod('hasStatus', function (code: number) {
    let response = this._obj;
    this.assert(
      response.status === code,
      `expected response status #{exp} but got #{act}.\n${detail(response)}`,
      `expected response status #{exp} to be different.\n${detail(response)})}`,
      code, // expected
      response.status // actual
    );
  });

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

function standardize(src: string) {
  return src
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s{2,}/gm, ' ')
    .trim();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Chai {
    interface Assertion {
      hasStatus(expectedStatus: number): void;
      equalIgnoringWhiteSpace(expectedSource: string): void;
      containsSource(expectedSource: string): void;
    }
  }
}
