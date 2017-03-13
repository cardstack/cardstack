module.exports = function(chai, utils) {
  const { Assertion } = chai;

  Assertion.addMethod('hasStatus', function (code) {
    let response = this._obj;
    this.assert(
      response.status === code,
      `expected response status #{exp} but got #{act}.\n${utils.inspect(response.body)}`,
      `expected response status #{exp} to be different.\n${utils.inspect(response.body)}`,
      code,  // expected
      response.status  // actual
    );
  });
};
