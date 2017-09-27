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
    factory = new Factory();

    // Turning on mobiledoc so we can test indexing of plugin-customized content
    factory.addResource('plugin-configs', '@cardstack/mobiledoc');

    factory.addResource('content-types', 'articles').withRelated('fields', [
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
    let found = await searcher.get('master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('attributes.title');
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
    let found = await searcher.get('master', 'articles', article.id);
    expect(found).is.ok;
    expect(found).has.deep.property('attributes.title');
    expect(found).has.deep.property('relationships.author.data.id', person.id);
  });

});
