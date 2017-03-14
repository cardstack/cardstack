const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { grantAllPermissions } = require('@cardstack/test-support/permissions');
const PendingChange = require('@cardstack/data-source/pending-change');

describe('schema/validation', function() {

  let schema;

  before(async function() {
    let factory = new JSONAPIFactory();
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
      factory.addResource('fields', 'published-date')
        .withAttributes({
          fieldType: 'date',
          searchable: false
        })
        .withRelated('constraints', [
          factory.addResource('constraints')
            .withAttributes({ constraintType: 'not-null' })
        ]),
      factory.addResource('fields', 'primary-image')
        .withAttributes({
          fieldType: 'belongs-to'
        })
    ]);

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.getResource('fields', 'title')
      ]);

    factory.addResource('content-types', 'things-with-defaults')
      .withRelated('fields', [
        factory.addResource('fields', 'timestamp')
          .withAttributes({
            fieldType: 'date',
            defaultAtUpdate: 'now'
          }),
        factory.addResource('fields', 'karma')
          .withAttributes({
            fieldType: 'integer',
            defaultAtCreate: 0
          })
      ]);

    grantAllPermissions(factory);

    schema = await Schema.loadFrom(factory.getModels());
  });

  after(async function() {
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });

  it("rejects unknown type", async function() {
    expect(await schema.validationErrors(create({
      type: 'unicorns',
      id: '1'
    }))).includes.something.with.property('detail', '"unicorns" is not a valid type');
  });

  it("rejects mismatched type", async function() {
    expect(await schema.validationErrors(create({
      type: 'articles',
      id: '1'
    }), {
      type: 'unicorns'
    })).includes.something.with.property('detail', 'the type "articles" is not allowed here');
  });

  it("rejects mismatched id", async function() {
    expect(await schema.validationErrors(create({
      type: 'articles',
      id: '1'
    }), {
      type: 'articles',
      id: '2'
    })).collectionContains({
      status: 403,
      detail: 'not allowed to change "id"'
    });
  });


  it("accepts known types", async function() {
    expect(await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        'published-date': "2013-02-08 09:30:26.123+07:00"
      }
    }), {
      type: 'articles'
    } )).to.deep.equal([]);
  });

  it("rejects unknown fields", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        popularity: 100,
        pomposity: 'high'
      }
    }));
    expect(errors).collectionContains({
      detail: 'type "articles" has no field named "popularity"',
      source: { pointer: '/data/attributes/popularity' },
      status: 400
    });
    expect(errors).collectionContains({
      detail: 'type "articles" has no field named "pomposity"',
      source: { pointer: '/data/attributes/pomposity' },
      status: 400
    });
  });

  it("rejects attribute in relationships", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      relationships: {
        title: "new title"
      }
    }));
    expect(errors).collectionContains({
      detail: 'field "title" should be in attributes, not relationships',
      source: { pointer: '/data/relationships/title' },
      status: 400
    });
  });

  it("rejects relationship in attribute", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        'primary-image': { data: null }
      }
    }));
    expect(errors).collectionContains({
      detail: 'field "primary-image" should be in relationships, not attributes',
      source: { pointer: '/data/attributes/primary-image' },
      status: 400
    });
  });

  it("accepts known fields", async function() {
    expect(await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00"
      }
    }))).deep.equals([]);
  });

  it("rejects badly formatted fields", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        title: 21,
        "published-date": "Not a date"
      }
    }));
    expect(errors).collectionContains({
      detail: '21 is not a valid value for field "title"',
      source: { pointer: '/data/attributes/title' },
      status: 400
    });
    expect(errors).collectionContains({
      detail: '"Not a date" is not a valid value for field "published-date"',
      source: { pointer: '/data/attributes/published-date' },
      status: 400
    });
  });

  it("applies constraints to present fields", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        title: "very long very long very long very long very long very long"
      }
    }));
    expect(errors).collectionContains({
      detail: 'the value of field "title" may not exceed max length of 40 characters',
      status: 400,
      source: { pointer: '/data/attributes/title' }
    });
  });

  it("applies constraints to missing fields", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        title: "very long very long very long very long very long very long"
      }
    }));
    expect(errors).includes.something.with.property('detail', 'the value of field "published-date" may not be null');
  });

  it("generates a mapping", async function() {
    let mapping = schema.mapping();
    expect(mapping).has.deep.property("articles.properties.published-date.index", false);
    expect(mapping).has.deep.property("events.properties.title");
  });

  it("can lookup up a writer for a content type", async function() {
    expect(schema.types.get('articles').dataSource).is.ok;
    expect(schema.types.get('articles').dataSource.writer).is.ok;

    // this relies on knowing a tiny bit of writer's internals. When
    // we have a more complete plugin system we should just inject a
    // fake writer plugin for this test to avoid the coupling.
    expect(schema.types.get('articles').dataSource.writer).has.property('repoPath', 'http://example.git/repo.git');
  });

  it.skip("applies defaults at creation", async function() {
    let pending = create({
      type: 'things-with-defaults'
    });
    await schema.validate(pending);
    expect(pending).has.deep.property('serverProvidedValues.timestamp');
    expect(pending).has.deep.property('serverProvidedValues.karma');
    expect(pending.finalDocument.attributes).deep.equals({
      karma: 0,
      timestamp: pending.serverProvidedValues.timestamp
    });
  });
});

function create(document) {
  return new PendingChange(null, document, null);
}
