const processTemplate = require('./template-helper');
const moduleName = 'templates/components/cardstack/foo';

describe('rendering/transform', function() {
  it('it does not touch nodes without mustache statements', function() {
    let template = '<h1 id="main-headline" class="headline">Welcome to Cardstack</h1>';
    let result = processTemplate(template, { moduleName });
    expect(result).to.equal(template);
  });

  it('it rewrites bare field references', function() {
    let result = processTemplate("{{content.foo}}", { moduleName });
    expect(result).to.equal('{{cs-field content "foo"}}');
  });

  it('it rewrites attribute assignments when `content` is in the path', function() {
    let result = processTemplate('<img class="cs-image" data-test-image="book-image" src={{content.imageUrl}} />', { moduleName });
    expect(result).to.equal('{{#cs-field content "imageUrl" as |param1|}}<img class="cs-image" data-test-image="book-image" src={{param1}}></img>{{/cs-field}}');
  });

  it('it does not rewrite attribute assignments when `content` is not in the path', function() {
    let template = '<img class="cs-image" data-test-image="book-image" src={{model.imageUrl}} />';
    // Even just returning the node turns <img /> into <img></img>
    let outputTemplate = '<img class="cs-image" data-test-image="book-image" src={{model.imageUrl}}></img>';
    let result = processTemplate(template, { moduleName });
    expect(result).to.equal(outputTemplate);
  });
});
