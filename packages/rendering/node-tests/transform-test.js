const processTemplate = require('./template-helper');
const moduleName = 'templates/components/cardstack/foo';

describe('rendering/transform', function() {
  it('it rewrites bare field references', function() {
    let result = processTemplate("{{content.foo}}", { moduleName });
    expect(result).to.equal('{{cs-field content "foo"}}');
  });

  it('it rewrites attribute assignments', function() {
    let result = processTemplate("<img src={{content.imageUrl}} />", { moduleName });
    expect(result).to.equal('{{#cs-field content "imageUrl" as |url|}}<img src={{url}}></img>{{/cs-field}}');
  });
});
