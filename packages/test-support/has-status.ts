export default function(chai: any, utils: any) {
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

  Assertion.addMethod('hasStatus', function(this: any, code: number) {
    let response = this._obj;
    this.assert(
      response.status === code,
      `expected response status #{exp} but got #{act}.\n${detail(response)}`,
      `expected response status #{exp} to be different.\n${detail(response)})}`,
      code, // expected
      response.status // actual
    );
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Chai {
    interface Assertion {
      hasStatus(expectedStatus: number): void;
    }
  }
}
