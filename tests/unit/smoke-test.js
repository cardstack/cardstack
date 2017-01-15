const example = require('../../src');

describe("Unit | Smoke Test", function() {
  it("hello world", function() {
    expect(example.hello()).to.equal('world');
  });
});
