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

  it('it prevents naming collisions for introduced block params', function() {
    let template = '{{#image-wrapper as |param1|}}<img class={{param1}} data-test-image="book-image" src={{content.imageUrl}} />{{/image-wrapper}}';
    let outputTemplate= '{{#image-wrapper as |param1|}}{{#cs-field content "imageUrl" as |param2|}}<img class={{param1}} data-test-image="book-image" src={{param2}}></img>{{/cs-field}}{{/image-wrapper}}';
    let result = processTemplate(template, { moduleName });
    expect(result).to.equal(outputTemplate);
  });

  it('it transforms >2 level trees with block params', function() {
    let template = '{{#cs-toolbox as |param1|}}{{#image-wrapper as |param2|}}<img class={{param2}} data-test-image="book-image" src={{content.imageUrl}} />{{/image-wrapper}}{{/cs-toolbox}}';
    let outputTemplate= '{{#cs-toolbox as |param1|}}{{#image-wrapper as |param2|}}{{#cs-field content "imageUrl" as |param3|}}<img class={{param2}} data-test-image="book-image" src={{param3}}></img>{{/cs-field}}{{/image-wrapper}}{{/cs-toolbox}}';
    let result = processTemplate(template, { moduleName });
    expect(result).to.equal(outputTemplate);
  });

  it('it *actually* transforms >2 level trees with block params', function() {
    let template = '<div>{{#image-wrapper as |param1|}}<img class={{param1}} data-test-image="book-image" src={{content.imageUrl}} />{{/image-wrapper}}</div>';
    let outputTemplate= '<div>{{#image-wrapper as |param1|}}{{#cs-field content "imageUrl" as |param2|}}<img class={{param1}} data-test-image="book-image" src={{param2}}></img>{{/cs-field}}{{/image-wrapper}}</div>';
    let result = processTemplate(template, { moduleName });
    expect(result).to.equal(outputTemplate);
  });

  it('it does not crash on literal paths', function() {
    processTemplate("<SomeComponent @a={{true}} />", { moduleName });
    processTemplate("<SomeComponent @b={{1}} />", { moduleName });
    processTemplate("<SomeComponent @c={{null}} />", { moduleName });
    processTemplate("<SomeComponent @d={{undefined}} />", { moduleName });
  });
});
