const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
const bootstrapSchema = require('../bootstrap-schema');
const { Registry, Container } = require('@cardstack/di');

describe('schema/validation', function() {

  let schema, ephemeralDataSource;

  before(async function() {
    let factory = new JSONAPIFactory();
    factory.importModels(bootstrapSchema);

    ephemeralDataSource = factory.addResource('data-sources')
        .withAttributes({
          sourceType: '@cardstack/ephemeral',
          params: {
            initialModels: [
              { type: 'hello', id: 'world' }
            ]
          }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated('defaultDataSource', ephemeralDataSource);

    let articleType = factory.addResource('content-types', 'articles')
        .withRelated('data-source', ephemeralDataSource);


    let titleField = factory.addResource('fields', 'title')
        .withAttributes({ fieldType: '@cardstack/core-types::string' });

    // A wide-open grant, because we're not testing authorization here
    // (that is covered in schema-auth-test.js).
    factory.addResource('grants').withRelated('who', { type: 'groups', id: 'everyone' }).withAttributes({
      mayCreateResource: true,
      mayReadResource: true,
      mayUpdateResource: true,
      mayDeleteResource: true,
      mayReadFields: true,
      mayWriteFields: true
    });

    factory.addResource('constraints')
      .withAttributes({
        constraintType: '@cardstack/core-types::max-length',
        inputs: { limit: 40  }
      })
      .withRelated('input-assignments', [
        factory.addResource('input-assignments')
          .withAttributes({ inputName: 'target' })
          .withRelated('field', titleField)
      ])
      .withRelated('required-content-types', [ articleType ]);

    let publishedDateField = factory.addResource('fields', 'published-date')
      .withAttributes({
        fieldType: '@cardstack/core-types::date',
        searchable: false
      });

    factory.addResource('constraints')
      .withAttributes({
        constraintType: '@cardstack/core-types::not-null'
      })
      .withRelated('input-assignments', [
        factory.addResource('input-assignments')
          .withAttributes({ inputName: 'target' })
          .withRelated('field', publishedDateField)
      ]);


    articleType.withRelated('fields', [
      titleField,
      publishedDateField,
      factory.addResource('fields', 'primary-image')
        .withAttributes({
          fieldType: '@cardstack/core-types::belongs-to'
        }).withRelated('relatedTypes', [
          factory.addResource('content-types', 'images')
        ]),
      factory.addResource('fields', 'detail-images')
        .withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        }).withRelated('relatedTypes', [
          factory.addResource('content-types', 'images')
        ])
    ]);

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.getResource('fields', 'title')
      ]);

    factory.addResource('content-types', 'things-with-defaults')
      .withRelated('fields', [
        factory.addResource('fields', 'timestamp')
          .withAttributes({
            fieldType: '@cardstack/core-types::date'
          }).withRelated(
            'defaultAtUpdate',
            factory.addResource('default-values')
              .withAttributes({ value: 'now' })
          ),
        factory.addResource('fields', 'karma')
          .withAttributes({
            fieldType: '@cardstack/core-types::integer'
          }).withRelated(
            'defaultAtCreate',
            factory.addResource('default-values').withAttributes({ value: 0 })
          )
      ]);

    let registry = new Registry();
    registry.register('config:project', { path: `${__dirname}/../../../tests/stub-project` });
    let container = new Container(registry);
    let loader = container.lookup('hub:schema-loader');
    schema = await loader.loadFrom(factory.getModels());
  });

  after(async function() {
    let ea = new ElasticAssert();
    await ea.deleteContentIndices();
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
      detail: 'title can be at most 40 characters long, it was 59',
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
    expect(errors).includes.something.with.property('detail', 'published-date must be present');
  });

  it("does not run a constraint whose input has already failed format validation", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        "published-date": "2013-02-08 09:30:26.123+07:00",
        title: 4000 // we're not going to run the max-length constraint because this is nonsense input
      }
    }));
    expect(errors).includes.something.with.property('detail', '4000 is not a valid value for field "title"');
    expect(errors).has.length(1);
  });

  it("runs constraints with valid inputs even when unrelated fields are invalid", async function() {
    let errors = await schema.validationErrors(create({
      type: 'articles',
      id: '1',
      attributes: {
        title: 4000 // we're not going to run the max-length constraint because this is nonsense input
      }
    }));
    expect(errors).includes.something.with.property('detail', 'published-date must be present');
  });

  it("generates a mapping", async function() {
    let mapping = schema.mapping();
    expect(mapping).has.deep.property("articles.properties.published-date.index", false);
    expect(mapping).has.deep.property("events.properties.title");
  });

  it("can lookup up a writer for a content type", async function() {
    expect(schema.types.get('articles').dataSource).is.ok;
    expect(schema.types.get('articles').dataSource.writer).is.ok;

    expect(schema.types.get('articles').dataSource).has.property('id', ephemeralDataSource.id);
    // this relies on knowing a tiny bit of writer's internals. When
    // we have a more complete plugin system we should just inject a
    // fake writer plugin for this test to avoid the coupling.
    expect(schema.types.get('articles').dataSource.writer).has.property('initialModels');
    expect(schema.types.get('articles').dataSource.writer.initialModels).deep.equals([{ type: 'hello', id: 'world' }]);
  });

  it("can lookup up an indexer on a data source", async function() {
    let source = schema.dataSources.get(ephemeralDataSource.id);
    expect(source).ok;
    expect(source.indexer).ok;
  });

  it("uses default data source", async function() {
    expect(schema.types.get('things-with-defaults').dataSource).is.ok;
    expect(schema.types.get('things-with-defaults').dataSource).has.property('id', ephemeralDataSource.id);
  });

  it("applies creation default", async function() {
    let pending = create({
      type: 'things-with-defaults'
    });
    await schema.validate(pending);
    expect(pending.serverProvidedValues.has('karma')).is.ok;
    expect(pending.finalDocument).has.deep.property('attributes.karma', 0);
  });

  it("applies update default at creation", async function() {
    let pending = create({
      type: 'things-with-defaults'
    });
    await schema.validate(pending);
    expect(pending.serverProvidedValues.has('timestamp')).is.ok;
    expect(pending.finalDocument).has.deep.property('attributes.timestamp');
    expect(pending.finalDocument.attributes.timestamp).equals(pending.serverProvidedValues.get('timestamp'));
  });

  it("applies update default at update", async function() {
    let pending = new PendingChange({
      type: 'things-with-defaults',
      id: '1',
      attributes: {
        timestamp: '2017-03-14T13:49:30Z',
        karma: 10
      }
    }, {
      type: 'things-with-defaults',
      id: '1',
      attributes: {
        timestamp: '2017-03-14T13:49:30Z',
        karma: 10
      }
    });
    await schema.validate(pending);
    expect(pending.serverProvidedValues.has('timestamp')).is.ok;
    expect(pending.finalDocument).has.deep.property('attributes.timestamp');
    expect(pending.finalDocument.attributes.timestamp).equals(pending.serverProvidedValues.get('timestamp'));
    expect(pending.originalDocument.attributes.timestamp).not.equals(pending.serverProvidedValues.get('timestamp'));
  });

  it("does not apply creation default when user provides a value", async function() {
    let pending = new PendingChange(null, {
      type: 'things-with-defaults',
      attributes: {
        karma: 10
      }
    });
    await schema.validate(pending);
    expect(pending.finalDocument.attributes.karma).equals(10);
  });

  it("will not accept a schema change that results in a dangling field reference", async function() {
    let pending = new PendingChange({
      type: 'fields',
      id: 'primary-image',
      attributes: {
        'field-type': '@cardstack/core-types::belongs-to'
      }
    }, null, null);
    let errors = await schema.validationErrors(pending);
    expect(errors).collectionContains({
      status: 400,
      title: 'Broken field reference',
      detail: 'content type "articles" refers to missing field "primary-image"'
    });
  });

  it("does not apply update default when user is altering value", async function() {
    let pending = new PendingChange({
      type: 'things-with-defaults',
      attributes: {
        timestamp: '2017-03-14T13:49:30Z'
      }
    }, {
      type: 'things-with-defaults',
      attributes: {
        timestamp: '2017-03-14T14:50:00Z'
      }
    });
    await schema.validate(pending);
    expect(pending.finalDocument.attributes.timestamp).equals('2017-03-14T14:50:00Z');
  });

  it("returns modified schema when validating a schema change", async function() {
    let pending = new PendingChange(null, {
      type: 'fields',
      id: 'extra-field',
      attributes: {
        'field-type': '@cardstack/core-types::belongs-to'
      }
    }, null);
    let newSchema = await schema.validate(pending);
    expect(newSchema).is.ok;
    expect([...newSchema.fields.keys()]).contains('extra-field');
  });

  it("applies related-types validation in belongs-to", async function() {
    let pending = create({
      type: 'articles',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00",
      },
      relationships: {
        'primary-image': {
          data: { type: 'not-an-image', id: '123' }
        }
      }
    });
    let errors = await schema.validationErrors(pending);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'field "primary-image" refers to disallowed type "not-an-image"'
    });
  });

  it("applies related-types validation in has-many", async function() {
    let pending = create({
      type: 'articles',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00",
      },
      relationships: {
        'detail-images': {
          data: [{ type: 'not-an-image', id: '123' }]
        }
      }
    });
    let errors = await schema.validationErrors(pending);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'field "detail-images" refers to disallowed type(s) "not-an-image"'
    });
  });

  it("applies belongs-to arity validation (failure case)", async function() {
    let pending = create({
      type: 'articles',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00",
      },
      relationships: {
        'primary-image': {
          data: [{ type: 'images', id: '123' }]
        }
      }
    });
    let errors = await schema.validationErrors(pending);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'field "primary-image" accepts only a single resource, not a list of resources'
    });
  });

  it("applies succeeding belongs-to arity validation (success case)", async function() {
    let pending = create({
      type: 'articles',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00",
      },
      relationships: {
        'primary-image': {
          data: { type: 'images', id: '123' }
        }
      }
    });
    await schema.validate(pending);
  });

  it("applies has-many arity validation (failure case)", async function() {
    let pending = create({
      type: 'articles',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00",
      },
      relationships: {
        'detail-images': {
          data: { type: 'images', id: '123' }
        }
      }
    });
    let errors = await schema.validationErrors(pending);
    expect(errors).collectionContains({
      status: 400,
      title: 'Validation error',
      detail: 'field "detail-images" accepts only a list of resources, not a single resource'
    });
  });

  it("applies has-many arity validation (success case)", async function() {
    let pending = create({
      type: 'articles',
      attributes: {
        title: "hello world",
        "published-date": "2013-02-08 09:30:26.123+07:00",
      },
      relationships: {
        'detail-images': {
          data: [{ type: 'images', id: '123' }]
        }
      }
    });
    await schema.validationErrors(pending);
  });

});

function create(document) {
  return new PendingChange(null, document, null);
}
