const processTemplate = require('./template-helper');
const moduleName = 'templates/components/cardstack/foo';

describe('rendering/transform', function() {
  it('it rewrites bare field references', function() {
    let result = processTemplate("{{content.foo}}", { moduleName });
    expect(result).to.equal('{{cs-field content "foo"}}');
  });
});
