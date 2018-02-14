/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/elasticsearch-test-app/node_modules/@cardstack/test-support/env');
const Factory = require('../../../tests/elasticsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');

describe('elasticsearch/indexer', function() {

  let env, factory, writer, indexer, searcher;

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

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/elasticsearch-test-app`, factory.getModels());
    writer = env.lookup('hub:writers');
    indexer = env.lookup('hub:indexers');
    searcher = env.lookup('hub:searchers');
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  // this scenario technically violates jsonapi spec, but our indexer needs to be tolerant of it
  it('tolerates missing relationship', async function() {
    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        author: null
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
  });

  it('indexes a belongs-to', async function() {
    let person = await writer.create('master', env.session, 'people', {
      type: 'people',
      attributes: {
        name: 'Quint'
      }
    });
    expect(person).has.deep.property('id');
    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        author: { data: { type: 'people', id: person.id } }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Quint');
  });

  it('reindexes included resources', async function() {
    let person = await writer.create('master', env.session, 'people', {
      type: 'people',
      attributes: {
        name: 'Quint'
      }
    });
    expect(person).has.deep.property('id');
    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        author: { data: { type: 'people', id: person.id } }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });

    person.attributes.name = 'Edward V';
    await writer.update('master', env.session, 'people', person.id, person);
    await indexer.update({ realTime: true });

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('reindexes included resources when both docs are already changing', async function() {
    let person = await writer.create('master', env.session, 'people', {
      type: 'people',
      attributes: {
        name: 'Quint'
      }
    });
    expect(person).has.deep.property('id');
    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        author: { data: { type: 'people', id: person.id } }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });

    person.attributes.name = 'Edward V';
    article.attributes.title = 'A Better Title';
    await writer.update('master', env.session, 'people', person.id, person);
    await writer.update('master', env.session, 'articles', article.id, article);
    await indexer.update({ realTime: true });

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'A Better Title');
    expect(found).has.deep.property('data.relationships.author.data.id', person.id);
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Edward V');
  });

  it('ignores a broken belongs-to', async function() {
    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        author: { data: { type: 'people', id: 'x' } },
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.author.data', null);
  });

  it('ignores a broken has-many', async function() {
    let person = await writer.create('master', env.session, 'people', {
      type: 'people',
      attributes: {
        name: 'Quint'
      }
    });
    expect(person).has.deep.property('id');

    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        reviewers: { data: [{ type: 'people', id: person.id }, { type: "people", id: 'x'} ]}
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });
    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.reviewers.data');
    expect(found.data.relationships.reviewers.data).length(1);
    expect(found.data.relationships.reviewers.data[0]).has.property('id', person.id);
  });


  it('can fix broken relationship when it is later fixed', async function() {
    let article = await writer.create('master', env.session, 'articles', {
      type: 'articles',
      attributes: {
        title: 'Hello World'
      },
      relationships: {
        author: { data: { type: 'people', id: 'x' } }
      }
    });
    expect(article).has.deep.property('id');
    await indexer.update({ realTime: true });

    let found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.attributes.title', 'Hello World');
    expect(found).has.deep.property('data.relationships.author.data', null);

    await writer.create('master', env.session, 'people', {
      id: 'x',
      type: 'people',
      attributes: {
        name: 'Quint'
      }
    });

    await indexer.update({ realTime: true });

    found = await searcher.get(env.session, 'master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('data.relationships.author.data.id', 'x');
    expect(found).has.property('included');
    expect(found.included).length(1);
    expect(found.included[0].attributes.name).to.equal('Quint');
  });

});
