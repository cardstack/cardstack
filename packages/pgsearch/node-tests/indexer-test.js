/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment,
  defaultDataSourceId
} = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/env');
const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');
const DocumentContext = require('@cardstack/hub/indexing/document-context');

describe('pgsearch/indexer', function() {

  let env, factory, writer, indexer, searcher, currentSchema, changedModels;

  before(async function() {
    this.timeout(5000);
    factory = new Factory();

    factory.addResource('content-types', 'puppies')
      .withAttributes({
        fieldsetExpansionFormat: 'isolated',
        fieldsets: {
          isolated: [{ field: 'puppy-friends', format: 'isolated' }]
        }
      })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'puppy-friends').withAttributes({
          fieldType: '@cardstack/core-types::has-many'
        })
      ]);

    factory.addResource('content-types', 'articles').withAttributes({
      defaultIncludes: ['author', 'reviewers']
    }).withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'author').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [
        factory.addResource('content-types', 'people')
          .withAttributes({
            defaultIncludes: ['friends'],
          })
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'friends').withAttributes({
            fieldType: '@cardstack/core-types::has-many'
          })
        ])
      ]),
      factory.addResource('fields', 'reviewers').withAttributes({
        fieldType: '@cardstack/core-types::has-many'
      }).withRelated('related-types', [
        factory.getResource('content-types', 'people')
      ])
    ]);

    changedModels = [];
    factory.addResource('data-sources')
      .withAttributes({
        'source-type': 'fake-indexer',
        params: { changedModels }
      });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/pgsearch-test-app`, factory.getModels());
    writer = env.lookup('hub:writers');
    indexer = env.lookup('hub:indexers');
    searcher = env.lookup('hub:searchers');
    currentSchema = env.lookup('hub:current-schema');
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  async function alterExpiration(type, id, interval) {
    let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    let result = await client.query(`update documents set expires = now() + $1 where type=$2 and id=$3`, [interval, type, id]);
    if (result.rowCount !== 1) {
      throw new Error(`test was unable to alter expiration`);
    }
  }

  // this scenario technically violates jsonapi spec, but our indexer needs to be tolerant of it
  it('tolerates missing relationship', async function() {
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: null
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });
    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
  });

  it('indexes a belongs-to', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });
    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Quint');
  });

  it('indexes a resource that is related to itself', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        id: 'vanGogh',
        type: 'people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'people', id: 'vanGogh' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'people', person.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ friends: { data: [{ type: 'people', id: person.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(0);
  });

  it('indexes a resource that includes a resource which has a relation to itself', async function() {
    let { data:circularPerson } = await writer.create(env.session, 'people', {
      data: {
        id: 'vanGogh2',
        type: 'people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'people', id: 'vanGogh2' }] }
        }
      }
    });
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        id: 'ringo',
        type: 'people',
        attributes: {
          name: 'Ringo'
        },
        relationships: {
          friends: { data: [{ type: 'people', id: 'vanGogh2' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'people', person.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ friends: { data: [{ type: 'people', id: circularPerson.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Van Gogh');
    expect(found.included[0].relationships).deep.equals({ friends: { data: [{ type: 'people', id: circularPerson.id }]}});
  });

  it('indexes a circular relationship', async function() {
    let { data:person1 } = await writer.create(env.session, 'people', {
      data: {
        id: 'hassan',
        type: 'people',
        attributes: {
          name: 'Hassan'
        },
        relationships: {
          friends: { data: [{ type: 'people', id: 'vanGogh3' }] }
        }
      }
    });
    let { data:person2 } = await writer.create(env.session, 'people', {
      data: {
        id: 'vanGogh3',
        type: 'people',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          friends: { data: [{ type: 'people', id: 'hassan' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'people', person1.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ friends: { data: [{ type: 'people', id: person2.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(1);

    expect(found.included[0].attributes.name).to.equal('Van Gogh');
    expect(found.included[0].relationships).deep.equals({ friends: { data: [{ type: 'people', id: person1.id }]}});
  });

  it('indexes a circular relationship by following fieldset paths', async function() {
    let { data:puppy1 } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'ringo',
        type: 'puppies',
        attributes: {
          name: 'Ringo'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'vanGogh' }] }
        }
      }
    });
    let { data:puppy2 } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'vanGogh',
        type: 'puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'ringo' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'puppies', puppy1.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: puppy2.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(1);

    expect(found.included[0].attributes.name).to.equal('Van Gogh');
    expect(found.included[0].relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: puppy1.id }]}});
  });

  it('indexes a resource that is related to itself by following fieldset paths', async function() {
    let { data:puppy } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'vanGogh2',
        type: 'puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'vanGogh2' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'puppies', puppy.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: puppy.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(0);
  });

  it('indexes a resource that includes a resource which has a relation to itself by following fieldset paths', async function() {
    let { data:circularPuppy } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'vanGogh3',
        type: 'puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'vanGogh3' }] }
        }
      }
    });
    let { data:puppy } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'ringo2',
        type: 'puppies',
        attributes: {
          name: 'Ringo'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'vanGogh3' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'puppies', puppy.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: circularPuppy.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Van Gogh');
    expect(found.included[0].relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: circularPuppy.id }]}});
  });

  /*
    I found a really interesting bug with our circular references test in pgsearch.
    In this test the invalidation that is triggered when `puppy/vanGogh4` is created,
    causes `puppy/ringo3` to be invalidated. `puppy/ringo3` updates correctly, however,
    because the reference was circular, the `puppy/ringo3` that was included in the
    pristine-doc of the first record (i’m just gonna call it `puppy/bagel` since i
    didn’t assert an ID), is actually incorrect now, as when it was originally indexed
    the reference from `puppy/ringo3` -> `puppy/vanGogh4` was not fashioned in the
    pristine doc of `puppy/bagel` since `puppy/vanGogh4` didn’t exist yet. This is a
    case where the invalidation should actually trigger another invalidation.
  */
  it.skip('indexes a resource that includes resources that have a circular relationship by following fieldset paths', async function() {
    let { data:puppy } = await writer.create(env.session, 'puppies', {
      data: {
        type: 'puppies',
        attributes: {
          name: 'Bagel'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'ringo3' }] }
        }
      }
    });
    let { data:puppy1 } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'ringo3',
        type: 'puppies',
        attributes: {
          name: 'Ringo'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'vanGogh4' }] }
        }
      }
    });
    let { data:puppy2 } = await writer.create(env.session, 'puppies', {
      data: {
        id: 'vanGogh4',
        type: 'puppies',
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          'puppy-friends': { data: [{ type: 'puppies', id: 'ringo3' }] }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'puppies', puppy.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.name');
    expect(found.data.relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: puppy1.id }]}});
    expect(found).has.property('included');
    expect(found.included).length(2);
    let included1 = found.included.find(i => i.type === puppy1.type && i.id === puppy1.id);
    let included2 = found.included.find(i => i.type === puppy2.type && i.id === puppy2.id);

    expect(included1.attributes.name).to.equal('Ringo');
    expect(included1.relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: puppy2.id }]}});
    expect(included2.attributes.name).to.equal('Van Gogh');
    expect(included2.relationships).deep.equals({ 'puppy-friends': { data: [{ type: 'puppies', id: puppy1.id }]}});
  });

  it('reuses included resources when building pristine document when upstreamDoc has includes', async function() {
    const schema = await currentSchema.getSchema();

    let documentFetchCount = 0;
    let read = async (type, id) => {
      documentFetchCount++;
      let result;
      try {
        result = await searcher.get(env.session, 'local-hub', type, id);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      if (result && result.data) {
        return result.data;
      }
    };

    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });

    let { id, type } = article;
    let { data:resource, included } = await searcher.get(env.session, 'local-hub', type, id);

    let pristineDoc = await (new DocumentContext({ id, type, schema, read,
      upstreamDoc: { data: resource },
    })).pristineDoc();

    expect(documentFetchCount).to.equal(1);
    expect(pristineDoc).to.deep.equal({ data: resource, included });

    documentFetchCount = 0;

    pristineDoc = await (new DocumentContext({ id, type, schema, read,
      upstreamDoc: { data: resource, included },
    })).pristineDoc();

    expect(documentFetchCount).to.equal(0);
    expect(pristineDoc).to.deep.equal({ data: resource, included });
  });

  it('reindexes included resources', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    await writer.update(env.session, 'people', person.id, { data: person });
    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it("doesn't reuse included upstream resource if it has been invalidated", async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');

    // Need to use pgsearch client to add this document directly to the index, as the
    // hub:writers.create API strips out the included resources that are provided in the upstream doc
    const articleId = '1';
    let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    let schema = await currentSchema.getSchema();
    let batch = client.beginBatch(schema, searcher);
    await batch.saveDocument(searcher.createDocumentContext({
      schema,
      type: 'articles',
      id: articleId,
      sourceId: defaultDataSourceId,
      upstreamDoc: {
        data: {
          id: articleId,
          type: 'articles',
          attributes: {
            title: 'Hello World'
          },
          relationships: {
            author: { data: { type: 'people', id: person.id } }
          }
        },
        included: [person]
      }
    }));
    await batch.done();
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    await writer.update(env.session, 'people', person.id, { data: person });
    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'local-hub', 'articles', articleId);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes included resources when both docs are already changing', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    article.attributes.title = 'A Better Title';
    await writer.update(env.session, 'people', person.id, { data: person });
    await writer.update(env.session, 'articles', article.id, { data: article });
    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes correctly when related resource is saved before own resource', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    article.attributes.title = 'A Better Title';
    changedModels.push({ type: person.type, id: person.id, model: person });
    changedModels.push({ type: article.type, id: article.id, model: article });

    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes correctly when related resource is saved after own resource', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    person.attributes.name = 'Edward V';
    article.attributes.title = 'A Better Title';
    changedModels.push({ type: article.type, id: article.id, model: article });
    changedModels.push({ type: person.type, id: person.id, model: person });

    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('invalidates resource that contains included resource that was updated', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });
    expect(article).has.deep.property('id');

    person.attributes.name = 'Edward V';
    await writer.update(env.session, 'people', person.id, { data: person });

    // note that indexer.update() is not called -- invalidation happens as a direct result of updating the doc

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('invalidates expired resources', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    await alterExpiration('people', person.id, '300 seconds');

    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: person.id } }
        }
      }
    });

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found.included[0].attributes.name).to.equal('Quint');

    await alterExpiration('people', person.id, '-300 seconds');
    // just need to touch any document to trigger expired resource invalidation
    await writer.update(env.session, 'articles', article.id, { data: article });

    found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).to.not.have.property('included');
    expect(found).to.have.deep.property('data.relationships.author.data', null);
  });

  it('ignores a broken belongs-to', async function() {
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: 'x' } },
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });
    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.author.data', null);
  });

  it('ignores a broken has-many', async function() {
    let { data:person } = await writer.create(env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');

    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          reviewers: { data: [{ type: 'people', id: person.id }, { type: "people", id: 'x'} ]}
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });
    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.reviewers.data');
    expect(found.data.relationships.reviewers.data).length(1);
    expect(found.data.relationships.reviewers.data[0]).has.property('id', person.id);
  });


  it('can fix broken relationship when it is later fixed', async function() {
    let { data:article } = await writer.create(env.session, 'articles', {
      data: {
        type: 'articles',
        attributes: {
          title: 'Hello World'
        },
        relationships: {
          author: { data: { type: 'people', id: 'x' } }
        }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'Hello World');
    expect(found).has.deep.property('data.relationships.author.data', null);

    await writer.create(env.session, 'people', {
      data: {
        id: 'x',
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });

    await indexer.update({ forceRefresh: true });

    found = await searcher.get(env.session, 'local-hub', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.author.data.id', 'x');
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Quint');
  });

});
