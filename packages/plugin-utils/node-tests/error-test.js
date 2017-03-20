const Error = require('@cardstack/plugin-utils/error');

describe("error helper", function() {
  it('supports default error titles', function() {
    let e = new Error("something bad happened", { status: 409 });
    expect(e.title).to.equal('Conflict');
  });
});
