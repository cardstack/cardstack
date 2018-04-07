const JSONAPIFactory = require('../../../tests/stub-static-models/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-static-models/node_modules/@cardstack/test-support/env');
const project = __dirname + '/../../../tests/stub-static-models';

describe('static-indexer', function() {
  let factory, env;

  beforeEach(async function() {
    factory = new JSONAPIFactory();
    factory.addResource('data-sources').withAttributes({
      'source-type': 'data-source-with-static',
      params: {
        otherThing2Title: 'chocolate cake'
      }
    });
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('can rely on schema from static content', async function() {
    factory.addResource('my-things', '1');
    env = await createDefaultEnvironment(project, factory.getModels());
  });

  it('can rely on static content', async function() {
    env = await createDefaultEnvironment(project, factory.getModels());
    await env.lookup('hub:searchers').get(env.session, 'master', 'other-things', '2');
  });

  it('has access to data source params', async function() {
    env = await createDefaultEnvironment(project, factory.getModels());
    let thing = await env.lookup('hub:searchers').get(env.session, 'master', 'other-things', '2');
    expect(thing).has.deep.property('data.attributes.title', 'chocolate cake');
  });

});
