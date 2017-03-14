const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('schema/auth', function() {

  let factory;

  before(async function() {

    factory = new JSONAPIFactory();
    let articleType = factory.addResource('content-types', 'articles');

    articleType.withRelated(
      'data-source',
      factory.addResource('data-sources')
        .withAttributes({
          sourceType: 'git',
          params: {
            repo: 'http://example.git/repo.git'
          }
        }));

    articleType.withRelated('fields', [
      factory.addResource('fields', 'title')
        .withAttributes({ fieldType: 'string' })
        .withRelated('constraints', [
          factory.addResource('constraints')
            .withAttributes({
              constraintType: 'length',
              parameters: { max: 40 }
            })
        ]),
      factory.addResource('fields', 'published-data')
        .withAttributes({
          fieldType: 'date',
          searchable: false
        })
        .withRelated('constraints', [
          factory.addResource('constraints')
            .withAttributes({ constraintType: 'not-null' })
        ])
    ]);

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.getResource('fields', 'title')
      ]);

  });

  after(async function() {
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });

  it("forbids creation", async function() {
    let schema = await Schema.loadFrom(factory.getModels());
    let action = create({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not create this resource'
    });
  });

  it("forbids deletion", async function() {
    let schema = await Schema.loadFrom(factory.getModels());
    let action = deleteIt({
      type: 'articles',
      id: '1'
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not delete this resource'
    });
  });

  it("forbids update", async function() {
    let schema = await Schema.loadFrom(factory.getModels());
    let action = update({
      type: 'articles',
      id: '1',
      attributes: {
        title: 'x'
      }
    },{
      type: 'articles',
      id: '1',
      attributes: {
        title: 'y'
      }
    });
    let errors = await schema.validationErrors(action);
    expect(errors).collectionContains({
      status: 401,
      detail: 'You may not update this resource'
    });
  });

});

function create(document) {
  return {
    finalDocument: document,
    originalDocument: null
  };
}

function deleteIt(document) {
  return {
    finalDocument: null,
    originalDocument: document
  };
}

function update(older, newer) {
  return {
    finalDocument: newer,
    originalDocument: older
  };
}
