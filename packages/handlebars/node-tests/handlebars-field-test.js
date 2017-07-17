const field = require('../cardstack/field-type');

describe("handlebars field type", function() {

  it("rejects null", function() {
    expect(field.valid(null)).not.ok;
  });

  it("rejects number", function() {
    expect(field.valid(1)).not.ok;
  });

  it("rejects malformed template", function() {
    expect(field.valid("{{unclosed")).not.ok;
  });

  it("accepts valid template", function() {
    expect(field.valid("{{hello}}")).is.ok;
  });

});
