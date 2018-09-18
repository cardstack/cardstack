/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/env');
const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');

describe('pgsearch/indexer', function() {

  let env, factory, writer, indexer, searcher, changedModels;

  before(async function() {
    this.timeout(2500);
    factory = new Factory();

    factory.addResource('content-types', 'articles').withAttributes({
      defaultIncludes: ['author', 'reviewers']
    }).withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'author').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [
        factory.addResource('content-types', 'people').withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
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
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  async function alterExpiration(branch, type, id, interval) {
    let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    let result = await client.query(`update documents set expires = now() + $1 where branch=$2 and type=$3 and id=$4`, [interval, branch, type, id]);
    if (result.rowCount !== 1) {
      throw new Error(`test was unable to alter expiration`);
    }
  }

  // this scenario technically violates jsonapi spec, but our indexer needs to be tolerant of it
  it('tolerates missing relationship', async function() {
    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
  });

  it('indexes a belongs-to', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Quint');
  });

  it('reindexes included resources', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    await writer.update('master', env.session, 'people', person.id, { data: person });
    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes included resources when both docs are already changing', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    await writer.update('master', env.session, 'people', person.id, { data: person });
    await writer.update('master', env.session, 'articles', article.id, { data: article });
    await indexer.update({ forceRefresh: true });

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes correctly when related resource is saved before own resource', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create('master', env.session, 'articles', {
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

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes correctly when related resource is saved after own resource', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create('master', env.session, 'articles', {
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

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('invalidates resource that contains included resource that was updated', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');
    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    await writer.update('master', env.session, 'people', person.id, { data: person });

    // note that indexer.update() is not called -- invalidation happens as a direct result of updating the doc

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('invalidates expired resources', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    await alterExpiration('master', 'people', person.id, '300 seconds');

    let { data:article } = await writer.create('master', env.session, 'articles', {
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

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found.included[0].attributes.name).to.equal('Quint');

    await alterExpiration('master', 'people', person.id, '-300 seconds');
    // just need to touch any document to trigger expired resource invalidation
    await writer.update('master', env.session, 'articles', article.id, { data: article });

    found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).to.not.have.property('included');
    expect(found).to.have.deep.property('data.relationships.author.data', null);
  });

  it('ignores a broken belongs-to', async function() {
    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.author.data', null);
  });

  it('ignores a broken has-many', async function() {
    let { data:person } = await writer.create('master', env.session, 'people', {
      data: {
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });
    expect(person).has.deep.property('id');

    let { data:article } = await writer.create('master', env.session, 'articles', {
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
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.reviewers.data');
    expect(found.data.relationships.reviewers.data).length(1);
    expect(found.data.relationships.reviewers.data[0]).has.property('id', person.id);
  });


  it('can fix broken relationship when it is later fixed', async function() {
    let { data:article } = await writer.create('master', env.session, 'articles', {
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

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'Hello World');
    expect(found).has.deep.property('data.relationships.author.data', null);

    await writer.create('master', env.session, 'people', {
      data: {
        id: 'x',
        type: 'people',
        attributes: {
          name: 'Quint'
        }
      }
    });

    await indexer.update({ forceRefresh: true });

    found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.author.data.id', 'x');
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Quint');
  });

});
