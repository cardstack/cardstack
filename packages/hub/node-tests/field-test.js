const Field = require('../schema/field');

describe('hub/field', function() {
  it('accepts valid json:api field names', function() {
    let validNames = [
      'a',
      'A',
      'alpha',
      'Alpha',
      'alPha',
      '0',
      '000',
      '0a1b2c',
      'foo-bar',
      'foo_bar'
    ];
    for (let name of validNames) {
      expect(Field.isValidName(name)).to.equal(true, `${name} should be accepted`);
    }
  });

  it('rejects invalid json:api field names', function() {
    let invalidNames = [
      '-foo',
      'foo/bar',
      'foo-',
      '_foo',
      'foo_'
    ];
    for (let name of invalidNames) {
      expect(Field.isValidName(name)).to.equal(false, `${name} should not be accepted`);
    }
  });

});
