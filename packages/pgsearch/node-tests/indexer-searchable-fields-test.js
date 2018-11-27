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

describe.only('pgsearch/indexer searchable fields', function() {
  this.timeout(2500);

  let writer, searcher, env;

  async function createFactory(factory) {
    for(const model of factory.getModels()) {
      await writer.create('master', env.session, model.type, {
        data: model
      });
    }
  }

  beforeEach(async function() {
    let factory = new Factory();

    factory.addResource('data-sources')
      .withAttributes({
        'source-type': 'fake-indexer',
        params: {
          changedModels: []
        }
      });


    env = await createDefaultEnvironment(`${__dirname}/../../../tests/pgsearch-test-app`, factory.getModels());
    writer = env.lookup('hub:writers');
    searcher = env.lookup('hub:searchers');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });


  it('ignores a field that is not searchable', async function(){
    let factory = new Factory();

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
          // includeInDocumentSearch: false
        }),
        factory.addResource('fields', 'breed').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('puppies', 'first-puppy')
      .withAttributes({
        name: 'Ringo',
        breed: 'yorkie',
      });

    factory.addResource('puppies', 'second-puppy')
      .withAttributes({
        name: 'Van Gogh',
        breed: 'huskie'
      });

    await createFactory(factory);

    let { data: models } = await searcher.search(env.session, 'master', {
      queryString: 'huskie'
    });

    expect(models).to.have.length(1);
    expect(models).includes.something.with.deep.property('attributes.name', 'Van Gogh');

    let { data: models2 } = await searcher.search(env.session, 'master', {
      queryString: 'Ringo'
    });

    expect(models2).to.have.length(0);
  });
});
