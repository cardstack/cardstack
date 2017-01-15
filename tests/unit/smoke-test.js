const example = require('../../src');

describe("Unit | Smoke Test", function() {
  it("hello world", async function() {
    expect(await example.hello()).to.equal('world');
  });
});
